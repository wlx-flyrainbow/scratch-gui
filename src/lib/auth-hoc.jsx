import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import ZhimengLoginForm from '../components/menu-bar/zhimeng-login-form.jsx';
import authConfig from './auth/config';
import {login, refresh, fetchEntitlement, logout, createOrder, getOrderStatus, mockOrderPaid} from './auth/api';
import {buildLease, isLeaseValid} from './auth/lease';
import {loadAuthBundle, saveAuthBundle, clearAuthBundle} from './auth/storage';
import {setEntitlement, setPermissions, setSession, clearSession} from '../reducers/session';

const hasFeature = (entitlement, feature) => {
    const features = entitlement && entitlement.features;
    return Array.isArray(features) && features.includes(feature);
};

const AuthHOC = WrappedComponent => {
    class AuthComponent extends React.Component {
        constructor (props) {
            super(props);
            this.state = {
                isReady: false
            };
            this.handleLogin = this.handleLogin.bind(this);
            this.handleLogout = this.handleLogout.bind(this);
            this.handleOpenRegistration = this.handleOpenRegistration.bind(this);
            this.handleOpenBilling = this.handleOpenBilling.bind(this);
            this.handleRefreshEntitlement = this.handleRefreshEntitlement.bind(this);
            this.renderLogin = this.renderLogin.bind(this);
        }

        componentDidMount () {
            this.bootstrap();
        }

        async bootstrap () {
            try {
                const bundle = await loadAuthBundle();
                if (!bundle || !bundle.session || !bundle.session.user) {
                    this.props.onSetSession(null);
                    this.props.onSetEntitlement(null);
                    this.setState({isReady: true});
                    return;
                }

                let accessToken = bundle.tokens && bundle.tokens.access_token;
                const refreshToken = bundle.tokens && bundle.tokens.refresh_token;
                let entitlement = bundle.entitlement || null;

                const leaseNeedsRefresh = !entitlement || !isLeaseValid(entitlement);
                if (leaseNeedsRefresh && refreshToken) {
                    try {
                        const refreshed = await refresh(refreshToken);
                        accessToken = refreshed.access_token;
                        entitlement = await fetchEntitlement(accessToken);
                    } catch (err) {
                        if (err.status === 401) {
                            await clearAuthBundle();
                            this.props.onClearSession();
                            this.setState({isReady: true});
                            return;
                        }
                        // Network or 5xx: keep last-known session; cloud stays off until lease is valid again.
                        entitlement = bundle.entitlement;
                        accessToken = bundle.session.user.token;
                    }
                }

                if (entitlement && !entitlement.lease) {
                    entitlement = buildLease(entitlement, authConfig.leaseDays);
                }

                const session = {
                    user: {
                        ...bundle.session.user,
                        token: accessToken || bundle.session.user.token
                    }
                };

                await saveAuthBundle({
                    tokens: {
                        access_token: session.user.token,
                        refresh_token: refreshToken
                    },
                    session,
                    entitlement
                });

                this.props.onSetSession(session);
                this.props.onSetPermissions(bundle.permissions || {});
                this.props.onSetEntitlement(entitlement);
            } catch (err) {
                await clearAuthBundle();
                this.props.onClearSession();
            } finally {
                this.setState({isReady: true});
            }
        }

        async handleLogin (payload) {
            const result = await login(payload);
            const leasedEntitlement = buildLease(result.entitlement || {}, authConfig.leaseDays);
            const session = {user: {...result.user, token: result.access_token}};
            await saveAuthBundle({
                tokens: {
                    access_token: result.access_token,
                    refresh_token: result.refresh_token
                },
                session,
                entitlement: leasedEntitlement,
                permissions: result.permissions || {}
            });
            this.props.onSetSession(session);
            this.props.onSetPermissions(result.permissions || {});
            this.props.onSetEntitlement(leasedEntitlement);
        }

        async handleLogout () {
            try {
                const bundle = await loadAuthBundle();
                const refreshToken = bundle && bundle.tokens && bundle.tokens.refresh_token;
                if (refreshToken) await logout(refreshToken);
            } catch (e) {
                // Best effort logout.
            }
            await clearAuthBundle();
            this.props.onClearSession();
        }

        handleOpenRegistration () {
            if (typeof window !== 'undefined') {
                window.open(authConfig.registerUrl, '_blank', 'noopener,noreferrer');
            }
        }

        async handleRefreshEntitlement () {
            const bundle = await loadAuthBundle();
            const refreshToken = bundle && bundle.tokens && bundle.tokens.refresh_token;
            if (!refreshToken) throw new Error('当前会话缺少 refresh token，请重新登录');
            const refreshed = await refresh(refreshToken);
            const accessToken = refreshed.access_token;
            const entitlement = await fetchEntitlement(accessToken);
            const leasedEntitlement = buildLease(entitlement, authConfig.leaseDays);
            const session = {
                user: {
                    ...(bundle.session && bundle.session.user ? bundle.session.user : {}),
                    token: accessToken
                }
            };
            await saveAuthBundle({
                tokens: {
                    access_token: accessToken,
                    refresh_token: refreshToken
                },
                session,
                entitlement: leasedEntitlement,
                permissions: bundle.permissions || {}
            });
            this.props.onSetSession(session);
            this.props.onSetEntitlement(leasedEntitlement);
            return leasedEntitlement;
        }

        async handleOpenBilling () {
            const user = this.props.session && this.props.session.user;
            if (!user || !user.token) throw new Error('请先登录后再购买');
            const created = await createOrder(user.token, {
                plan: 'family_yearly',
                channel: 'wechat',
                return_url: authConfig.billingUrl
            });
            if (typeof window !== 'undefined' && created && created.pay_url) {
                window.open(created.pay_url, '_blank', 'noopener,noreferrer');
            }
            if (typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname)) {
                await mockOrderPaid(user.token, created.order_id);
            }
            if (created && created.order_id) {
                await getOrderStatus(user.token, created.order_id);
            }
            await this.handleRefreshEntitlement();
        }

        renderLogin ({onClose}) {
            return (
                <ZhimengLoginForm
                    onClose={onClose}
                    onLogin={this.handleLogin}
                />
            );
        }

        render () {
            const user = this.props.session && this.props.session.user;
            const entitlement = this.props.entitlement;
            const hasSession = Boolean(user);
            const active = Boolean(entitlement && entitlement.status === 'active');
            const leaseValid = isLeaseValid(entitlement);
            // Cloud features need active entitlement + valid offline lease; see zhimeng-auth-entitlement-design.md.
            const cloudEnabled =
                hasSession && active && leaseValid && hasFeature(entitlement, 'cloud_save');
            const communityEnabled = cloudEnabled && hasFeature(entitlement, 'community');
            const shareEnabled = cloudEnabled && hasFeature(entitlement, 'share');
            const backpackAllowed =
                hasSession && active && leaseValid && hasFeature(entitlement, 'backpack');
            const cloudHostResolved = authConfig.cloudHost || this.props.cloudHost || null;
            const mergedBackpackHost =
                authConfig.backpackHost || this.props.backpackHost || null;
            const urlBackpackSelfTest =
                typeof window !== 'undefined' &&
                /[?&]token=/.test(window.location.search) &&
                /[?&]username=/.test(window.location.search) &&
                /[?&]backpack_host=/.test(window.location.search);
            const backpackVisibleResolved =
                Boolean(mergedBackpackHost) && (urlBackpackSelfTest || backpackAllowed);
            let authNotice = '';
            if (!hasSession) {
                authNotice = '登录知萌账号后可解锁云保存、分享与社区能力';
            } else if (!active) {
                authNotice = '当前订阅未生效或已到期，请续费后解锁云功能';
            } else if (!leaseValid) {
                authNotice = '授权租约已过期，请联网刷新授权';
            }

            if (!this.state.isReady) return null;

            return (
                <WrappedComponent
                    {...this.props}
                    backpackHost={mergedBackpackHost}
                    backpackVisible={backpackVisibleResolved}
                    canSave={cloudEnabled}
                    canShare={shareEnabled}
                    cloudHost={cloudHostResolved}
                    enableCommunity={communityEnabled}
                    hasCloudPermission={cloudEnabled}
                    showComingSoon={!cloudEnabled}
                    onLogOut={this.handleLogout}
                    onOpenRegistration={this.handleOpenRegistration}
                    onOpenBilling={this.handleOpenBilling}
                    onRefreshEntitlement={this.handleRefreshEntitlement}
                    renderLogin={this.renderLogin}
                    authNotice={authNotice}
                />
            );
        }
    }

    AuthComponent.propTypes = {
        backpackHost: PropTypes.string,
        cloudHost: PropTypes.string,
        entitlement: PropTypes.object,
        onClearSession: PropTypes.func.isRequired,
        onSetEntitlement: PropTypes.func.isRequired,
        onSetPermissions: PropTypes.func.isRequired,
        onSetSession: PropTypes.func.isRequired,
        session: PropTypes.object
    };

    const mapStateToProps = state => ({
        entitlement: state.session && state.session.entitlement,
        session: state.session && state.session.session
    });

    const mapDispatchToProps = dispatch => ({
        onSetSession: session => dispatch(setSession(session)),
        onSetPermissions: permissions => dispatch(setPermissions(permissions)),
        onSetEntitlement: entitlement => dispatch(setEntitlement(entitlement)),
        onClearSession: () => dispatch(clearSession())
    });

    return connect(mapStateToProps, mapDispatchToProps)(AuthComponent);
};

export default AuthHOC;

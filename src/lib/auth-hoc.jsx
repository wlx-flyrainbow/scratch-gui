import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import ZhimengLoginForm from '../components/menu-bar/zhimeng-login-form.jsx';
import authConfig from './auth/config';
import {login, refresh, fetchEntitlement, logout} from './auth/api';
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

                if (!entitlement || !isLeaseValid(entitlement)) {
                    if (refreshToken) {
                        const refreshed = await refresh(refreshToken);
                        accessToken = refreshed.access_token;
                        entitlement = await fetchEntitlement(accessToken);
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
            const cloudEnabled = hasSession && active;
            const communityEnabled = cloudEnabled && hasFeature(entitlement, 'community');
            const shareEnabled = cloudEnabled && hasFeature(entitlement, 'share');
            const leaseValid = isLeaseValid(entitlement);
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
                    canSave={cloudEnabled}
                    canShare={shareEnabled}
                    enableCommunity={communityEnabled}
                    showComingSoon={!cloudEnabled}
                    onLogOut={this.handleLogout}
                    onOpenRegistration={this.handleOpenRegistration}
                    renderLogin={this.renderLogin}
                    sessionExists
                    authNotice={authNotice}
                />
            );
        }
    }

    AuthComponent.propTypes = {
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

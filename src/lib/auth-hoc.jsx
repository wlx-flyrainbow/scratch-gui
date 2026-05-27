import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import ZhimengLoginForm from '../components/menu-bar/zhimeng-login-form.jsx';
import authConfig from './auth/config';
import {
    login,
    register,
    refresh,
    fetchEntitlement,
    bindDevice,
    logout,
    createOrder,
    getOrderStatus,
    submitPaymentProof
} from './auth/api';
import {buildLease, isLeaseValid} from './auth/lease';
import {loadAuthBundle, saveAuthBundle, clearAuthBundle, loadDeviceIdentity} from './auth/storage';
import {setEntitlement, setPermissions, setSession, clearSession} from '../reducers/session';

const hasFeature = (entitlement, feature) => {
    const features = entitlement && entitlement.features;
    return Array.isArray(features) && features.includes(feature);
};

const resolveAuthCapabilities = ({entitlement, user, cloudHost, projectHost}) => {
    const hasSession = Boolean(user);
    const active = Boolean(entitlement && entitlement.status === 'active');
    const leaseValid = isLeaseValid(entitlement);
    const entitlementAllowsCloudSave = hasSession && active && leaseValid && hasFeature(entitlement, 'cloud_save');
    const cloudSaveEnabled = entitlementAllowsCloudSave && Boolean(projectHost);
    const cloudDataEnabled = entitlementAllowsCloudSave && Boolean(cloudHost);

    return {
        active,
        cloudDataEnabled,
        cloudSaveEnabled,
        hasSession,
        leaseValid
    };
};

const isOrderFulfilled = order => order && order.status === 'fulfilled';

const AuthHOC = WrappedComponent => {
    class AuthComponent extends React.Component {
        constructor (props) {
            super(props);
            this.state = {
                billingError: null,
                billingModalOpen: false,
                billingOrder: null,
                billingPaymentMethod: 'wechat',
                billingProofError: null,
                billingProofSubmitted: false,
                billingSubmitting: false,
                billingStatusRefreshing: false,
                authActionError: null,
                isReady: false,
                loginModalOpen: false
            };
            this.handleLogin = this.handleLogin.bind(this);
            this.handleLogout = this.handleLogout.bind(this);
            this.handleCloseBilling = this.handleCloseBilling.bind(this);
            this.handleCloseLogin = this.handleCloseLogin.bind(this);
            this.handleOpenBilling = this.handleOpenBilling.bind(this);
            this.handleOpenExternalBilling = this.handleOpenExternalBilling.bind(this);
            this.handleOpenLogin = this.handleOpenLogin.bind(this);
            this.handlePaymentMethodChange = this.handlePaymentMethodChange.bind(this);
            this.handleRefreshBillingOrder = this.handleRefreshBillingOrder.bind(this);
            this.handleRefreshEntitlement = this.handleRefreshEntitlement.bind(this);
            this.handleRefreshEntitlementForUi = this.handleRefreshEntitlementForUi.bind(this);
            this.handleRegister = this.handleRegister.bind(this);
            this.handleSubmitPaymentProof = this.handleSubmitPaymentProof.bind(this);
            this.bindCurrentDevice = this.bindCurrentDevice.bind(this);
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
                        entitlement = await this.bindCurrentDevice(accessToken, entitlement);
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
            await this.applyAuthResult(result);
        }

        async handleRegister (payload) {
            const result = await register(payload);
            await this.applyAuthResult(result);
        }

        async bindCurrentDevice (accessToken, entitlement) {
            if (!accessToken || !entitlement) return entitlement;
            try {
                const device = await loadDeviceIdentity();
                const bound = await bindDevice(accessToken, {
                    device_id: device.device_id,
                    device_name: device.device_name
                });
                return {
                    ...entitlement,
                    device_count: bound && bound.device_count
                };
            } catch (err) {
                if (err.status === 409) {
                    this.setState({
                        authActionError: '当前账号最多可绑定 3 台设备，请联系运营解绑旧设备后再使用。'
                    });
                    return {
                        ...entitlement,
                        status: 'deviceLimit',
                        device_limit: entitlement.device_limit || 3
                    };
                }
                if (err.status === 403) {
                    this.setState({
                        authActionError: '当前账号已被冻结，请联系运营处理。'
                    });
                    return {
                        ...entitlement,
                        status: 'frozen'
                    };
                }
                throw err;
            }
        }

        async applyAuthResult (result) {
            const entitlement = await this.bindCurrentDevice(
                result.access_token,
                result.entitlement || {}
            );
            const leasedEntitlement = buildLease(entitlement || {}, authConfig.leaseDays);
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
            this.setState({
                authActionError: leasedEntitlement.status === 'deviceLimit' ?
                    '当前账号最多可绑定 3 台设备，请联系运营解绑旧设备后再使用。' :
                    (leasedEntitlement.status === 'frozen' ? '当前账号已被冻结，请联系运营处理。' : null),
                loginModalOpen: false
            });
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
            this.setState({
                billingOrder: null,
                billingModalOpen: false,
                billingProofError: null,
                billingProofSubmitted: false
            });
        }

        handleOpenLogin () {
            this.setState({
                authActionError: null,
                loginModalOpen: true
            });
        }

        handleCloseLogin () {
            this.setState({loginModalOpen: false});
        }

        handleCloseBilling () {
            this.setState({
                billingModalOpen: false,
                billingError: null,
                billingProofError: null
            });
        }

        async handleRefreshEntitlement () {
            try {
                this.setState({authActionError: null});
                const bundle = await loadAuthBundle();
                const refreshToken = bundle && bundle.tokens && bundle.tokens.refresh_token;
                if (!refreshToken) throw new Error('登录状态已失效，请重新登录新祥编程账号。');
                const refreshed = await refresh(refreshToken);
                const accessToken = refreshed.access_token;
                const entitlement = await this.bindCurrentDevice(
                    accessToken,
                    await fetchEntitlement(accessToken)
                );
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
            } catch (err) {
                const message = err.message || '刷新授权失败，请稍后重试。';
                this.setState({authActionError: message});
                throw err;
            }
        }

        handleRefreshEntitlementForUi () {
            this.handleRefreshEntitlement().catch(() => {
                // User-facing copy is displayed through authActionError.
            });
        }

        async handleOpenBilling (channel = 'wechat', plan = 'family_yearly') {
            const user = this.props.session && this.props.session.user;
            if (!user || !user.token) {
                this.setState({loginModalOpen: true});
                return null;
            }
            const paymentChannel = ['wechat', 'alipay'].includes(channel) ? channel : 'wechat';
            const selectedPlan = ['family_yearly', 'bootcamp_7d'].includes(plan) ? plan : 'family_yearly';
            if (this.state.billingOrder && this.state.billingOrder.plan === selectedPlan) {
                this.setState({
                    billingModalOpen: true,
                    billingPaymentMethod: paymentChannel
                });
                return this.state.billingOrder;
            }
            this.setState({
                billingError: null,
                billingPaymentMethod: paymentChannel,
                billingProofError: null,
                billingProofSubmitted: false,
                billingModalOpen: true,
                billingSubmitting: true
            });
            try {
                const created = await createOrder(user.token, {
                    plan: selectedPlan,
                    channel: paymentChannel,
                    return_url: authConfig.billingUrl
                });
                this.setState({billingOrder: created});
                return created;
            } catch (err) {
                this.setState({billingError: err.message || '创建订单失败，请稍后重试'});
                return null;
            } finally {
                this.setState({billingSubmitting: false});
            }
        }

        handlePaymentMethodChange (paymentMethod) {
            this.setState({
                billingPaymentMethod: paymentMethod || 'wechat'
            });
        }

        async handleRefreshBillingOrder () {
            const user = this.props.session && this.props.session.user;
            const order = this.state.billingOrder;
            if (!user || !user.token || !order || !order.order_id) return null;
            this.setState({
                billingStatusRefreshing: true,
                billingError: null,
                billingProofError: null
            });
            let refreshedOrder = null;
            try {
                const refreshed = await getOrderStatus(user.token, order.order_id);
                const nextOrder = {...order, ...refreshed};
                refreshedOrder = nextOrder;
                this.setState({billingOrder: nextOrder});
                if (isOrderFulfilled(nextOrder)) {
                    await this.handleRefreshEntitlement();
                    this.setState({
                        billingModalOpen: false,
                        billingProofSubmitted: false
                    });
                }
                return refreshed;
            } catch (err) {
                const message = isOrderFulfilled(refreshedOrder) ?
                    '订单已确认，但刷新授权失败，请重新登录或稍后再试' :
                    (err.message || '刷新订单状态失败，请稍后重试');
                this.setState({billingError: message});
                return null;
            } finally {
                this.setState({billingStatusRefreshing: false});
            }
        }

        async handleSubmitPaymentProof (payload) {
            const user = this.props.session && this.props.session.user;
            const order = this.state.billingOrder;
            if (!user || !user.token || !order || !order.order_id) {
                this.setState({billingProofError: '订单信息不完整，请重新创建订单'});
                return null;
            }
            this.setState({
                billingProofError: null,
                billingProofSubmitted: false,
                billingSubmitting: true
            });
            try {
                const result = await submitPaymentProof(user.token, order.order_id, payload);
                this.setState({
                    billingOrder: {...order, ...result},
                    billingProofSubmitted: true
                });
                return result;
            } catch (err) {
                this.setState({billingProofError: err.message || '提交付款凭证失败，请检查后重试'});
                return null;
            } finally {
                this.setState({billingSubmitting: false});
            }
        }

        handleOpenExternalBilling () {
            const order = this.state.billingOrder;
            if (typeof window !== 'undefined' && order && order.pay_url) {
                window.open(order.pay_url, '_blank', 'noopener,noreferrer');
            }
        }

        renderLogin ({onClose}) {
            return (
                <ZhimengLoginForm
                    onClose={onClose}
                    onLogin={this.handleLogin}
                    onRegister={this.handleRegister}
                />
            );
        }

        render () {
            const {
                onClearSession, // eslint-disable-line no-unused-vars
                onSetEntitlement, // eslint-disable-line no-unused-vars
                onSetPermissions, // eslint-disable-line no-unused-vars
                onSetSession, // eslint-disable-line no-unused-vars
                ...componentProps
            } = this.props;
            const user = this.props.session && this.props.session.user;
            const entitlement = this.props.entitlement;
            const cloudHostResolved = authConfig.cloudHost || this.props.cloudHost || null;
            const projectHostResolved = authConfig.projectHost || this.props.projectHost || null;
            const {
                active,
                cloudDataEnabled,
                cloudSaveEnabled,
                hasSession,
                leaseValid
            } = resolveAuthCapabilities({
                cloudHost: cloudHostResolved,
                entitlement,
                projectHost: projectHostResolved,
                user
            });
            const communityEnabled = cloudSaveEnabled && hasFeature(entitlement, 'community');
            const shareEnabled = cloudSaveEnabled && hasFeature(entitlement, 'share');
            const backpackAllowed =
                hasSession && active && leaseValid && hasFeature(entitlement, 'backpack');
            const mergedBackpackHost =
                authConfig.backpackHost || this.props.backpackHost || null;
            const urlBackpackSelfTest =
                typeof window !== 'undefined' &&
                /[?&]token=/.test(window.location.search) &&
                /[?&]username=/.test(window.location.search) &&
                /[?&]backpack_host=/.test(window.location.search);
            const backpackVisibleResolved =
                Boolean(mergedBackpackHost) && (urlBackpackSelfTest || backpackAllowed);
            const appUnlocked = hasSession && active && leaseValid;
            const entitlementStatus = entitlement && entitlement.status;
            let authStatus = 'locked';
            let authNotice = '';
            if (hasSession && active && leaseValid) {
                authStatus = 'active';
            } else if (hasSession && active) {
                authStatus = 'leaseExpired';
                authNotice = '授权租约已过期，请联网刷新授权';
            } else if (hasSession && entitlementStatus === 'expired') {
                authStatus = 'expired';
                authNotice = '当前订阅已到期，请续费后刷新授权';
            } else if (hasSession && entitlementStatus === 'frozen') {
                authStatus = 'frozen';
                authNotice = '当前账号已被冻结，请联系运营处理';
            } else if (hasSession && entitlementStatus === 'deviceLimit') {
                authStatus = 'deviceLimit';
                authNotice = '当前账号最多可绑定 3 台设备，请联系运营解绑旧设备';
            } else if (hasSession) {
                authStatus = 'inactive';
                authNotice = '当前订阅未生效或已到期，付款后需人工确认再刷新授权';
            } else {
                authStatus = 'signedOut';
                authNotice = '登录并订阅后可进入完整编程编辑器';
            }

            if (!this.state.isReady) return null;

            return (
                <WrappedComponent
                    {...componentProps}
                    backpackHost={mergedBackpackHost}
                    backpackVisible={backpackVisibleResolved}
                    canCreateNew={cloudSaveEnabled}
                    canSave={cloudSaveEnabled}
                    canShare={shareEnabled}
                    cloudHost={cloudHostResolved}
                    enableCommunity={communityEnabled}
                    hasCloudPermission={cloudDataEnabled}
                    showComingSoon={!cloudSaveEnabled}
                    onLogOut={this.handleLogout}
                    onOpenBilling={this.handleOpenBilling}
                    onRefreshEntitlement={this.handleRefreshEntitlementForUi}
                    renderLogin={this.renderLogin}
                    onRegister={this.handleRegister}
                    authNotice={authNotice}
                    authStatus={authStatus}
                    authActionError={this.state.authActionError}
                    billingError={this.state.billingError}
                    billingModalOpen={this.state.billingModalOpen}
                    billingOrder={this.state.billingOrder}
                    billingPaymentMethod={this.state.billingPaymentMethod}
                    billingProofError={this.state.billingProofError}
                    billingProofSubmitted={this.state.billingProofSubmitted}
                    billingSubmitting={this.state.billingSubmitting}
                    billingStatusRefreshing={this.state.billingStatusRefreshing}
                    entitlement={entitlement}
                    isAppUnlocked={appUnlocked}
                    loginModalOpen={this.state.loginModalOpen}
                    session={this.props.session}
                    onCloseBilling={this.handleCloseBilling}
                    onCloseLogin={this.handleCloseLogin}
                    onOpenExternalBilling={this.handleOpenExternalBilling}
                    onOpenLogin={this.handleOpenLogin}
                    onPaymentMethodChange={this.handlePaymentMethodChange}
                    onRefreshBillingOrder={this.handleRefreshBillingOrder}
                    onSubmitPaymentProof={this.handleSubmitPaymentProof}
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
        projectHost: PropTypes.string,
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
export {resolveAuthCapabilities};

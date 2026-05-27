import classNames from 'classnames';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';
import {connect} from 'react-redux';
import MediaQuery from 'react-responsive';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import tabStyles from 'react-tabs/style/react-tabs.css';
import VM from 'scratch-vm';
import Renderer from 'scratch-render';

import Blocks from '../../containers/blocks.jsx';
import CostumeTab from '../../containers/costume-tab.jsx';
import TargetPane from '../../containers/target-pane.jsx';
import SoundTab from '../../containers/sound-tab.jsx';
import StageWrapper from '../../containers/stage-wrapper.jsx';
import Loader from '../loader/loader.jsx';
import Box from '../box/box.jsx';
import MenuBar from '../menu-bar/menu-bar.jsx';
import Modal from '../../containers/modal.jsx';
import CostumeLibrary from '../../containers/costume-library.jsx';
import BackdropLibrary from '../../containers/backdrop-library.jsx';
import Watermark from '../../containers/watermark.jsx';

import Backpack from '../../containers/backpack.jsx';
import WebGlModal from '../../containers/webgl-modal.jsx';
import TipsLibrary from '../../containers/tips-library.jsx';
import Cards from '../../containers/cards.jsx';
import Alerts from '../../containers/alerts.jsx';
import DragLayer from '../../containers/drag-layer.jsx';
import ConnectionModal from '../../containers/connection-modal.jsx';
import TelemetryModal from '../telemetry-modal/telemetry-modal.jsx';

import layout, {STAGE_SIZE_MODES} from '../../lib/layout-constants';
import {resolveStageSize} from '../../lib/screen-utils';
import {themeMap} from '../../lib/themes';
import zhimengStarterProjects from '../../lib/zhimeng-starter-projects';

import styles from './gui.css';
import addExtensionIcon from './icon--extensions.svg';
import codeIcon from './icon--code.svg';
import costumesIcon from './icon--costumes.svg';
import soundsIcon from './icon--sounds.svg';
import zhimengLogo from '../../../static/app-icon.png';
import DebugModal from '../debug-modal/debug-modal.jsx';

const messages = defineMessages({
    addExtension: {
        id: 'gui.gui.addExtension',
        description: 'Button to add an extension in the target pane',
        defaultMessage: 'Add Extension'
    }
});

const formatAmount = (cents, currency) => {
    const value = Number(cents || 0) / 100;
    try {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: currency || 'CNY'
        }).format(value);
    } catch (e) {
        return `${currency || 'CNY'} ${value.toFixed(2)}`;
    }
};

const defaultPaidAt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

const paymentChannelLabel = channel => ({
    alipay: '支付宝',
    bank: '银行转账',
    other: '其他',
    wechat: '微信'
}[channel] || '微信');

const billingPlanLabel = plan => ({
    bootcamp_7d: '7 天项目陪跑包',
    family_yearly: '家庭年卡'
}[plan] || plan || '家庭年卡');

const paymentChannelConfig = channel => ({
    alipay: {
        label: '支付宝',
        noteLabel: '付款备注',
        hint: '请使用支付宝扫码付款，并在付款备注中填写上方订单备注，方便运营快速核对。',
        transferPlaceholder: '支付宝订单号或转账单号',
        merchantPlaceholder: '支付宝商家订单号，可从账单详情复制',
        tailPlaceholder: '支付宝交易号后 6-10 位'
    },
    bank: {
        label: '银行转账',
        noteLabel: '转账备注',
        hint: '请按运营提供的银行账户转账，并在转账备注中填写上方订单备注。',
        transferPlaceholder: '银行流水号或转账凭证号',
        merchantPlaceholder: '银行转账可留空',
        tailPlaceholder: '流水号后 6-10 位'
    },
    other: {
        label: '其他',
        noteLabel: '付款备注',
        hint: '请按运营沟通的方式付款，并填写可核对到账的凭证信息。',
        transferPlaceholder: '平台订单号或转账凭证号',
        merchantPlaceholder: '无商家订单号可留空',
        tailPlaceholder: '凭证号后 6-10 位'
    },
    wechat: {
        label: '微信',
        noteLabel: '付款备注',
        hint: '请使用微信扫码付款，并在付款备注中填写上方订单备注，方便运营快速核对。',
        transferPlaceholder: '微信转账单号或微信支付订单号',
        merchantPlaceholder: '微信付款可留空',
        tailPlaceholder: '微信交易号后 6-10 位'
    }
}[channel] || paymentChannelConfig('wechat'));

const switchQrChannel = (url, channel) => {
    if (!url || !['wechat', 'alipay'].includes(channel)) return null;
    if (/\/(wechat|alipay)\.jpg(?:[?#].*)?$/.test(url)) {
        return url.replace(/\/(wechat|alipay)\.jpg/, `/${channel}.jpg`);
    }
    return null;
};

const orderStatusLabel = status => ({
    created: '待确认',
    fulfilled: '已开通',
    paid: '已付款'
}[status] || '待付款');

const authStatusLabel = status => ({
    active: '已开通',
    deviceLimit: '设备已满',
    expired: '已到期',
    frozen: '已冻结',
    inactive: '待开通',
    leaseExpired: '需刷新',
    signedOut: '待登录'
}[status] || '待开通');

const localDateTimeToIso = value => {
    if (!value) return '';
    return new Date(value).toISOString();
};

const starterProgressStorageKey = 'zhimengStarterProjectProgress';

const loadStarterProgress = () => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        return JSON.parse(window.localStorage.getItem(starterProgressStorageKey)) || {};
    } catch (e) {
        return {};
    }
};

const saveStarterProgress = progress => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(starterProgressStorageKey, JSON.stringify(progress));
    } catch (e) {
        // Ignore storage failures; the starter entry should still open.
    }
};

// Cache this value to only retrieve it once the first time.
// Assume that it doesn't change for a session.
let isRendererSupported = null;

const GUIComponent = props => {
    const {
        accountNavOpen,
        activeTabIndex,
        alertsVisible,
        authorId,
        authorThumbnailUrl,
        authorUsername,
        authActionError,
        authNotice,
        authStatus,
        basePath,
        backdropLibraryVisible,
        backpackHost,
        backpackVisible,
        billingError,
        billingModalOpen,
        billingOrder,
        billingPaymentMethod,
        billingProofError,
        billingProofSubmitted,
        billingSubmitting,
        billingStatusRefreshing,
        blocksId,
        blocksTabVisible,
        cardsVisible,
        canChangeLanguage,
        canChangeTheme,
        canCreateNew,
        canEditTitle,
        canManageFiles,
        canRemix,
        canSave,
        canCreateCopy,
        canShare,
        canUseCloud,
        children,
        connectionModalVisible,
        costumeLibraryVisible,
        costumesTabVisible,
        debugModalVisible,
        enableCommunity,
        entitlement,
        intl,
        isAppUnlocked,
        isCreating,
        isFullScreen,
        isPlayerOnly,
        isRtl,
        isShared,
        isTelemetryEnabled,
        isTotallyNormal,
        loading,
        logo,
        renderLogin,
        loginModalOpen,
        onClickAbout,
        onClickAccountNav,
        onCloseAccountNav,
        onCloseBilling,
        onCloseLogin,
        onLogOut,
        onOpenBilling,
        onOpenExternalBilling,
        onOpenLogin,
        onOpenStarterProject,
        onPaymentMethodChange,
        onRefreshBillingOrder,
        onRefreshEntitlement,
        onSubmitPaymentProof,
        onToggleLoginOpen,
        onActivateCostumesTab,
        onActivateSoundsTab,
        onActivateTab,
        onClickLogo,
        onExtensionButtonClick,
        onProjectTelemetryEvent,
        onRequestCloseBackdropLibrary,
        onRequestCloseCostumeLibrary,
        onRequestCloseDebugModal,
        onRequestCloseTelemetryModal,
        onSeeCommunity,
        onShare,
        onShowPrivacyPolicy,
        onStartSelectingFileUpload,
        onTelemetryModalCancel,
        onTelemetryModalOptIn,
        onTelemetryModalOptOut,
        showComingSoon,
        soundsTabVisible,
        stageSizeMode,
        targetIsStage,
        telemetryModalVisible,
        theme,
        tipsLibraryVisible,
        vm,
        ...componentProps
    } = omit(props, 'dispatch');
    if (children) {
        return <Box {...componentProps}>{children}</Box>;
    }

    const tabClassNames = {
        tabs: styles.tabs,
        tab: classNames(tabStyles.reactTabsTab, styles.tab),
        tabList: classNames(tabStyles.reactTabsTabList, styles.tabList),
        tabPanel: classNames(tabStyles.reactTabsTabPanel, styles.tabPanel),
        tabPanelSelected: classNames(tabStyles.reactTabsTabPanelSelected, styles.isSelected),
        tabSelected: classNames(tabStyles.reactTabsTabSelected, styles.isSelected)
    };

    const [starterProgress, setStarterProgress] = React.useState(loadStarterProgress);
    const completedStarterCount = zhimengStarterProjects.filter(project => (
        starterProgress[project.id] && starterProgress[project.id].completed
    )).length;

    const updateStarterProgress = (project, patch) => {
        const nextProgress = Object.assign({}, starterProgress, {
            [project.id]: Object.assign({}, starterProgress[project.id], patch)
        });
        setStarterProgress(nextProgress);
        saveStarterProgress(nextProgress);
    };

    const getStarterProjectFromEvent = event => (
        zhimengStarterProjects.find(project => (
            project.id === event.currentTarget.getAttribute('data-project-id')
        ))
    );

    const handleOpenStarterProject = event => {
        const project = getStarterProjectFromEvent(event);
        if (!project) return;
        updateStarterProgress(project, {
            started: true,
            startedAt: (
                starterProgress[project.id] &&
                starterProgress[project.id].startedAt
            ) || new Date().toISOString()
        });
        onOpenStarterProject(project.id);
    };

    const handleCompleteStarterProject = event => {
        const project = getStarterProjectFromEvent(event);
        if (!project) return;
        updateStarterProgress(project, {
            completed: true,
            completedAt: new Date().toISOString(),
            title: project.title
        });
    };

    const handlePaymentProofSubmit = event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmitPaymentProof({
            method: data.get('method'),
            paid_at: localDateTimeToIso(data.get('paid_at')),
            amount: data.get('amount'),
            currency: billingOrder && billingOrder.currency ? billingOrder.currency : 'CNY',
            transfer_no: data.get('transfer_no'),
            merchant_order_no: data.get('merchant_order_no'),
            trade_no_tail: data.get('trade_no_tail'),
            payer_note: data.get('payer_note')
        });
    };
    const handleCreateOrderSubmit = event => {
        event.preventDefault();
        const channel = event.currentTarget.elements.channel.value;
        const plan = event.currentTarget.elements.plan.value;
        onOpenBilling(channel, plan);
    };
    const handlePaymentMethodChange = event => {
        onPaymentMethodChange(event.currentTarget.value);
    };
    const billingAmountValue = billingOrder ?
        (Number(billingOrder.amount_cents || 0) / 100).toFixed(2) :
        '0.00';
    const billingOrderFulfilled = billingOrder && billingOrder.status === 'fulfilled';
    const billingProofWaiting = Boolean(
        !billingOrderFulfilled &&
        billingOrder &&
        (billingProofSubmitted || billingOrder.payment_proof)
    );
    const billingOrderAmount = billingOrder ?
        formatAmount(billingOrder.amount_cents, billingOrder.currency) :
        null;
    const selectedPaymentMethod = billingPaymentMethod || (billingOrder && billingOrder.channel) || 'wechat';
    const billingChannel = paymentChannelLabel(selectedPaymentMethod);
    const selectedPaymentCopy = paymentChannelConfig(selectedPaymentMethod);
    const paymentMethods = billingOrder && billingOrder.payment_methods ? billingOrder.payment_methods : {};
    const selectedPaymentMethodConfig = paymentMethods[selectedPaymentMethod] || {};
    const billingQrCodeUrl = selectedPaymentMethodConfig.qr_code_url ||
        (billingOrder && selectedPaymentMethod === billingOrder.channel ? billingOrder.qr_code_url : null) ||
        (billingOrder ? switchQrChannel(billingOrder.qr_code_url, selectedPaymentMethod) : null);
    const canSubscribeFromLock = authStatus !== 'frozen' && authStatus !== 'deviceLimit';

    if (isRendererSupported === null) {
        isRendererSupported = Renderer.isSupported();
    }

    return (<MediaQuery minWidth={layout.fullSizeMinWidth}>{isFullSize => {
        const stageSize = resolveStageSize(stageSizeMode, isFullSize);

        return isPlayerOnly ? (
            <StageWrapper
                isFullScreen={isFullScreen}
                isRendererSupported={isRendererSupported}
                isRtl={isRtl}
                loading={loading}
                stageSize={STAGE_SIZE_MODES.large}
                vm={vm}
            >
                {alertsVisible ? (
                    <Alerts className={styles.alertsContainer} />
                ) : null}
            </StageWrapper>
        ) : (
            <Box
                className={styles.pageWrapper}
                dir={isRtl ? 'rtl' : 'ltr'}
                {...componentProps}
            >
                {telemetryModalVisible ? (
                    <TelemetryModal
                        isRtl={isRtl}
                        isTelemetryEnabled={isTelemetryEnabled}
                        onCancel={onTelemetryModalCancel}
                        onOptIn={onTelemetryModalOptIn}
                        onOptOut={onTelemetryModalOptOut}
                        onRequestClose={onRequestCloseTelemetryModal}
                        onShowPrivacyPolicy={onShowPrivacyPolicy}
                    />
                ) : null}
                {loading ? (
                    <Loader />
                ) : null}
                {isCreating ? (
                    <Loader messageId="gui.loader.creating" />
                ) : null}
                {isRendererSupported ? null : (
                    <WebGlModal isRtl={isRtl} />
                )}
                {tipsLibraryVisible ? (
                    <TipsLibrary />
                ) : null}
                {cardsVisible ? (
                    <Cards />
                ) : null}
                {alertsVisible ? (
                    <Alerts className={styles.alertsContainer} />
                ) : null}
                {connectionModalVisible ? (
                    <ConnectionModal
                        vm={vm}
                    />
                ) : null}
                {costumeLibraryVisible ? (
                    <CostumeLibrary
                        vm={vm}
                        onRequestClose={onRequestCloseCostumeLibrary}
                    />
                ) : null}
                {<DebugModal
                    isOpen={debugModalVisible}
                    onClose={onRequestCloseDebugModal}
                />}
                {backdropLibraryVisible ? (
                    <BackdropLibrary
                        vm={vm}
                        onRequestClose={onRequestCloseBackdropLibrary}
                    />
                ) : null}
                {loginModalOpen ? (
                    <Modal
                        className={styles.zhimengAuthModal}
                        contentLabel={'登录新祥编程账号'}
                        id="zhimeng-login"
                        onRequestClose={onCloseLogin}
                    >
                        <div className={styles.zhimengModalBody}>
                            <div className={styles.zhimengLoginForm}>
                                {renderLogin({
                                    onClose: onCloseLogin
                                })}
                            </div>
                        </div>
                    </Modal>
                ) : null}
                {billingModalOpen ? (
                    <Modal
                        className={styles.zhimengBillingModal}
                        contentLabel={'新祥编程订阅中心'}
                        id="zhimeng-billing"
                        onRequestClose={onCloseBilling}
                    >
                        <div className={styles.zhimengModalBody}>
                            <div className={styles.billingHeader}>
                                <div className={styles.billingBrandHeader}>
                                    <img
                                        alt=""
                                        className={styles.zhimengBrandLogo}
                                        src={zhimengLogo}
                                    />
                                    <div>
                                        <div className={styles.zhimengModalEyebrow}>{'新祥编程订阅'}</div>
                                        <div className={styles.zhimengModalTitle}>{'开通完整编程编辑器'}</div>
                                        <div className={styles.zhimengModalDescription}>
                                            {'扫码付款后提交凭证，运营确认到账后刷新授权即可进入完整编辑器。'}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className={classNames(
                                        styles.billingStatusPill,
                                        authStatus === 'active' ? styles.isActive : null
                                    )}
                                >
                                    {authStatusLabel(authStatus)}
                                </div>
                            </div>
                            {billingError ? (
                                <div className={styles.zhimengError}>{billingError}</div>
                            ) : null}
                            {billingOrder ? (
                                <div>
                                    <div className={styles.billingProgressPanel}>
                                        <div className={styles.orderSteps}>
                                            <div className={styles.orderStepDone}>{'1. 创建订单'}</div>
                                            <div
                                                className={billingProofSubmitted || billingOrder.payment_proof ?
                                                    styles.orderStepDone :
                                                    styles.orderStepCurrent}
                                            >
                                                {'2. 付款并提交凭证'}
                                            </div>
                                            <div
                                                className={billingOrderFulfilled ?
                                                    styles.orderStepDone :
                                                    styles.orderStepMuted}
                                            >
                                                {'3. 运营确认后解锁'}
                                            </div>
                                        </div>
                                        <div className={styles.orderMeta}>
                                            <div>
                                                <span>{'订单号'}</span>
                                                <strong>{billingOrder.order_id}</strong>
                                            </div>
                                            <div>
                                                <span>{'状态'}</span>
                                                <strong>{orderStatusLabel(billingOrder.status)}</strong>
                                            </div>
                                            <div>
                                                <span>{'套餐'}</span>
                                                <strong>{billingPlanLabel(billingOrder.plan)}</strong>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.billingCheckout}>
                                        <div className={styles.paymentGuide}>
                                            <div className={styles.paymentGuideHeader}>
                                                <div>
                                                    <div className={styles.paymentGuideLabel}>{'应付金额'}</div>
                                                    <div className={styles.paymentAmount}>{billingOrderAmount}</div>
                                                </div>
                                                <div
                                                    className={classNames(
                                                        styles.paymentChannelBadge,
                                                        selectedPaymentMethod === 'alipay' ? styles.isAlipay : null,
                                                        selectedPaymentMethod === 'bank' ? styles.isBank : null,
                                                        selectedPaymentMethod === 'other' ? styles.isOther : null
                                                    )}
                                                >
                                                    {billingChannel}
                                                </div>
                                            </div>
                                            <div className={styles.qrPanel}>
                                                {billingQrCodeUrl ? (
                                                    <img
                                                        alt={`新祥编程${billingChannel}收款二维码`}
                                                        src={billingQrCodeUrl}
                                                    />
                                                ) : (
                                                    <div className={styles.qrMissing}>
                                                        {`${billingChannel}二维码暂不可用`}
                                                    </div>
                                                )}
                                            </div>
                                            <div className={styles.paymentNoteBox}>
                                                <span>{selectedPaymentCopy.noteLabel}</span>
                                                <strong>{billingOrder.payment_note || '按页面提示填写订单号'}</strong>
                                            </div>
                                            <p className={styles.paymentHint}>
                                                {selectedPaymentCopy.hint}
                                            </p>
                                        </div>
                                        <div className={styles.proofPanel}>
                                            {billingOrderFulfilled ? (
                                                <div className={styles.zhimengSuccess}>
                                                    {'订单已确认，授权刷新后将自动进入完整编辑器。'}
                                                </div>
                                            ) : null}
                                            {billingProofWaiting ? (
                                                <div className={styles.zhimengSuccess}>
                                                    {'付款凭证已提交，等待运营核对到账后开通授权。'}
                                                </div>
                                            ) : null}
                                            {billingProofError ? (
                                                <div className={styles.zhimengError}>{billingProofError}</div>
                                            ) : null}
                                            <div className={styles.proofSectionTitle}>
                                                <strong>{'付款后提交凭证'}</strong>
                                                <span>{'填写到账信息即可，截图可后续补充给运营。'}</span>
                                            </div>
                                            <form
                                                className={styles.paymentProofForm}
                                                // eslint-disable-next-line react/jsx-no-bind
                                                onSubmit={handlePaymentProofSubmit}
                                            >
                                                <label>
                                                    <span>{'付款方式'}</span>
                                                    <select
                                                        name="method"
                                                        value={selectedPaymentMethod}
                                                        // eslint-disable-next-line react/jsx-no-bind
                                                        onChange={handlePaymentMethodChange}
                                                    >
                                                        <option value="wechat">{'微信'}</option>
                                                        <option value="alipay">{'支付宝'}</option>
                                                        <option value="bank">{'银行转账'}</option>
                                                        <option value="other">{'其他'}</option>
                                                    </select>
                                                </label>
                                                <label>
                                                    <span>{'付款时间'}</span>
                                                    <input
                                                        defaultValue={defaultPaidAt()}
                                                        name="paid_at"
                                                        required
                                                        type="datetime-local"
                                                    />
                                                </label>
                                                <label>
                                                    <span>{'实付金额'}</span>
                                                    <input
                                                        defaultValue={billingAmountValue}
                                                        inputMode="decimal"
                                                        name="amount"
                                                        required
                                                        type="text"
                                                    />
                                                </label>
                                                <label>
                                                    <span>{'转账/平台订单号'}</span>
                                                    <input
                                                        name="transfer_no"
                                                        placeholder={selectedPaymentCopy.transferPlaceholder}
                                                        required
                                                        type="text"
                                                    />
                                                </label>
                                                <label>
                                                    <span>{'支付宝商家订单号'}</span>
                                                    <input
                                                        name="merchant_order_no"
                                                        placeholder={selectedPaymentCopy.merchantPlaceholder}
                                                        type="text"
                                                    />
                                                </label>
                                                <label>
                                                    <span>{'交易号后 6-10 位'}</span>
                                                    <input
                                                        name="trade_no_tail"
                                                        placeholder={selectedPaymentCopy.tailPlaceholder}
                                                        required
                                                        type="text"
                                                    />
                                                </label>
                                                <label>
                                                    <span>{'备注'}</span>
                                                    <textarea
                                                        name="payer_note"
                                                        placeholder="付款账号昵称、截图说明等"
                                                        rows="2"
                                                    />
                                                </label>
                                                <div className={styles.billingActions}>
                                                    <button
                                                        className={styles.zhimengPrimaryButton}
                                                        disabled={billingSubmitting}
                                                        type="submit"
                                                    >
                                                        {billingSubmitting ? '正在提交...' : '提交付款凭证'}
                                                    </button>
                                                    <button
                                                        className={styles.zhimengSecondaryButton}
                                                        disabled={billingStatusRefreshing}
                                                        type="button"
                                                        onClick={onRefreshBillingOrder}
                                                    >
                                                        {billingStatusRefreshing ? '刷新中...' : '我已完成付款，刷新状态'}
                                                    </button>
                                                    {billingOrder.pay_url ? (
                                                        <button
                                                            className={styles.zhimengSecondaryButton}
                                                            type="button"
                                                            onClick={onOpenExternalBilling}
                                                        >
                                                            {'浏览器付款页'}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.planIntro}>
                                    <div className={styles.planCard}>
                                        <div>
                                            <div className={styles.planName}>{'家庭年卡'}</div>
                                            <p>{'适合孩子持续学习，用积木编程讲故事、做动画和小游戏。'}</p>
                                        </div>
                                        <div className={styles.planPrice}>{'¥199/年'}</div>
                                    </div>
                                    <div className={styles.planCard}>
                                        <div>
                                            <div className={styles.planName}>{'7 天项目陪跑包'}</div>
                                            <p>{'适合希望孩子 7 天内完成 3 个入门作品的家庭，运营群内轻陪跑。'}</p>
                                        </div>
                                        <div className={styles.planPrice}>{'¥699/期'}</div>
                                    </div>
                                    <form
                                        className={styles.createOrderForm}
                                        onSubmit={handleCreateOrderSubmit} // eslint-disable-line react/jsx-no-bind
                                    >
                                        <label>
                                            <span>{'选择套餐'}</span>
                                            <select
                                                defaultValue="family_yearly"
                                                name="plan"
                                            >
                                                <option value="family_yearly">{'家庭年卡 ¥199/年'}</option>
                                                <option value="bootcamp_7d">{'7 天项目陪跑包 ¥699/期'}</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span>{'选择付款方式'}</span>
                                            <select
                                                defaultValue="wechat"
                                                name="channel"
                                            >
                                                <option value="wechat">{'微信支付'}</option>
                                                <option value="alipay">{'支付宝'}</option>
                                            </select>
                                        </label>
                                        <button
                                            className={styles.zhimengPrimaryButton}
                                            disabled={billingSubmitting}
                                            type="submit"
                                        >
                                            {billingSubmitting ? '正在创建订单...' : '生成付款二维码'}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </Modal>
                ) : null}
                <MenuBar
                    accountNavOpen={accountNavOpen}
                    authorId={authorId}
                    authorThumbnailUrl={authorThumbnailUrl}
                    authorUsername={authorUsername}
                    canChangeLanguage={canChangeLanguage}
                    canChangeTheme={canChangeTheme}
                    canCreateCopy={canCreateCopy}
                    canCreateNew={canCreateNew}
                    canEditTitle={canEditTitle}
                    canManageFiles={canManageFiles}
                    canRemix={canRemix}
                    canSave={canSave}
                    canShare={canShare}
                    className={styles.menuBarPosition}
                    comingSoonHint={authNotice}
                    enableCommunity={enableCommunity}
                    entitlement={entitlement}
                    authStatus={authStatus}
                    isShared={isShared}
                    isTotallyNormal={isTotallyNormal}
                    logo={logo}
                    renderLogin={renderLogin}
                    showComingSoon={showComingSoon}
                    onClickAbout={onClickAbout}
                    onClickAccountNav={onClickAccountNav}
                    onClickLogo={onClickLogo}
                    onCloseAccountNav={onCloseAccountNav}
                    onLogOut={onLogOut}
                    onOpenBilling={onOpenBilling}
                    onOpenRegistration={onOpenLogin}
                    onProjectTelemetryEvent={onProjectTelemetryEvent}
                    onRefreshEntitlement={onRefreshEntitlement}
                    onSeeCommunity={onSeeCommunity}
                    onShare={onShare}
                    onStartSelectingFileUpload={onStartSelectingFileUpload}
                    onToggleLoginOpen={onOpenLogin || onToggleLoginOpen}
                />
                {authNotice ? (
                    <div className={styles.authNotice}>
                        <span>{authNotice}</span>
                        <div className={styles.authNoticeActions}>
                            {onOpenBilling && canSubscribeFromLock ? (
                                <button
                                    className={styles.authNoticeButton}
                                    onClick={onOpenBilling}
                                >
                                    {'订阅解锁'}
                                </button>
                            ) : null}
                            {onRefreshEntitlement ? (
                                <button
                                    className={styles.authNoticeButton}
                                    onClick={onRefreshEntitlement}
                                >
                                    {'刷新授权'}
                                </button>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                {authActionError ? (
                    <div
                        className={classNames(styles.authNotice, styles.authNoticeError)}
                        role="alert"
                    >
                        <span>{authActionError}</span>
                    </div>
                ) : null}
                {isAppUnlocked ? (
                    <Box className={styles.bodyWrapper}>
                        <details
                            className={classNames(
                                styles.starterGuide,
                                completedStarterCount > 0 && styles.hasStarterAchievement
                            )}
                            open
                        >
                            <summary>
                                <span>{'从第一个作品开始'}</span>
                                <strong>
                                    {completedStarterCount > 0 ?
                                        `已完成 ${completedStarterCount}/3 个` :
                                        '适合孩子第一次打开新祥编程'}
                                </strong>
                            </summary>
                            <div className={styles.starterGuideContent}>
                                {zhimengStarterProjects.map(project => {
                                    const progress = starterProgress[project.id] || {};
                                    return (
                                        <div
                                            className={classNames(
                                                styles.starterGuideItem,
                                                progress.completed && styles.isStarterCompleted
                                            )}
                                            key={project.id}
                                        >
                                            <button
                                                className={styles.starterGuideLaunch}
                                                data-project-id={project.id}
                                                type="button"
                                                onClick={handleOpenStarterProject} // eslint-disable-line
                                            >
                                                <span>{project.number}</span>
                                                <strong>{project.title}</strong>
                                                <em>{project.description}</em>
                                                <small>{project.time}</small>
                                            </button>
                                            <button
                                                className={styles.starterGuideComplete}
                                                data-project-id={project.id}
                                                disabled={progress.completed}
                                                type="button"
                                                onClick={handleCompleteStarterProject} // eslint-disable-line
                                            >
                                                {progress.completed ? '已完成' : '完成了'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            {completedStarterCount > 0 ? (
                                <div className={styles.starterGuideAchievement}>
                                    {completedStarterCount === zhimengStarterProjects.length ?
                                        '三个第一个作品都完成了，可以继续挑战新的主题。' :
                                        `已完成 ${completedStarterCount} 个第一个作品，继续保持。`}
                                </div>
                            ) : null}
                        </details>
                        <Box className={styles.flexWrapper}>
                            <Box className={styles.editorWrapper}>
                                <Tabs
                                    forceRenderTabPanel
                                    className={tabClassNames.tabs}
                                    selectedIndex={activeTabIndex}
                                    selectedTabClassName={tabClassNames.tabSelected}
                                    selectedTabPanelClassName={tabClassNames.tabPanelSelected}
                                    onSelect={onActivateTab}
                                >
                                    <TabList className={tabClassNames.tabList}>
                                        <Tab className={tabClassNames.tab}>
                                            <img
                                                draggable={false}
                                                src={codeIcon}
                                            />
                                            <FormattedMessage
                                                defaultMessage="Code"
                                                description="Button to get to the code panel"
                                                id="gui.gui.codeTab"
                                            />
                                        </Tab>
                                        <Tab
                                            className={tabClassNames.tab}
                                            onClick={onActivateCostumesTab}
                                        >
                                            <img
                                                draggable={false}
                                                src={costumesIcon}
                                            />
                                            {targetIsStage ? (
                                                <FormattedMessage
                                                    defaultMessage="Backdrops"
                                                    description="Button to get to the backdrops panel"
                                                    id="gui.gui.backdropsTab"
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Costumes"
                                                    description="Button to get to the costumes panel"
                                                    id="gui.gui.costumesTab"
                                                />
                                            )}
                                        </Tab>
                                        <Tab
                                            className={tabClassNames.tab}
                                            onClick={onActivateSoundsTab}
                                        >
                                            <img
                                                draggable={false}
                                                src={soundsIcon}
                                            />
                                            <FormattedMessage
                                                defaultMessage="Sounds"
                                                description="Button to get to the sounds panel"
                                                id="gui.gui.soundsTab"
                                            />
                                        </Tab>
                                    </TabList>
                                    <TabPanel className={tabClassNames.tabPanel}>
                                        <Box className={styles.blocksWrapper}>
                                            <Blocks
                                                key={`${blocksId}/${theme}`}
                                                canUseCloud={canUseCloud}
                                                grow={1}
                                                isVisible={blocksTabVisible}
                                                options={{
                                                    media: `${basePath}static/${themeMap[theme].blocksMediaFolder}/`
                                                }}
                                                stageSize={stageSize}
                                                theme={theme}
                                                vm={vm}
                                            />
                                        </Box>
                                        <Box className={styles.extensionButtonContainer}>
                                            <button
                                                className={styles.extensionButton}
                                                title={intl.formatMessage(messages.addExtension)}
                                                onClick={onExtensionButtonClick}
                                            >
                                                <img
                                                    className={styles.extensionButtonIcon}
                                                    draggable={false}
                                                    src={addExtensionIcon}
                                                />
                                            </button>
                                        </Box>
                                        <Box className={styles.watermark}>
                                            <Watermark />
                                        </Box>
                                    </TabPanel>
                                    <TabPanel className={tabClassNames.tabPanel}>
                                        {costumesTabVisible ? <CostumeTab vm={vm} /> : null}
                                    </TabPanel>
                                    <TabPanel className={tabClassNames.tabPanel}>
                                        {soundsTabVisible ? <SoundTab vm={vm} /> : null}
                                    </TabPanel>
                                </Tabs>
                                {backpackVisible ? (
                                    <Backpack host={backpackHost} />
                                ) : null}
                            </Box>

                            <Box className={classNames(styles.stageAndTargetWrapper, styles[stageSize])}>
                                <StageWrapper
                                    isFullScreen={isFullScreen}
                                    isRendererSupported={isRendererSupported}
                                    isRtl={isRtl}
                                    stageSize={stageSize}
                                    vm={vm}
                                />
                                <Box className={styles.targetWrapper}>
                                    <TargetPane
                                        stageSize={stageSize}
                                        vm={vm}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    <Box className={styles.bodyWrapper}>
                        <div className={styles.lockedExperience}>
                            <div className={styles.lockedContent}>
                                <div className={styles.lockedBrandRow}>
                                    <img
                                        alt=""
                                        className={styles.lockedBrandLogo}
                                        src={zhimengLogo}
                                    />
                                    <div>
                                        <div className={styles.lockedBrand}>{'新祥编程'}</div>
                                        <div className={styles.lockedBrandSub}>{'少儿创意编程启蒙'}</div>
                                    </div>
                                </div>
                                <h1>{'用积木编程讲故事、做动画和小游戏'}</h1>
                                <p>
                                    {'登录并开通订阅后，即可进入完整编程编辑器，开启孩子的创意编程练习空间。'}
                                </p>
                                <div className={styles.lockedStatus}>
                                    {authActionError || authNotice || '当前账号未开通完整编辑器权限'}
                                </div>
                                <div className={styles.lockedActions}>
                                    {onOpenLogin ? (
                                        <button
                                            className={styles.zhimengPrimaryButton}
                                            onClick={onOpenLogin}
                                        >
                                            {'登录账号'}
                                        </button>
                                    ) : null}
                                    {onOpenBilling && canSubscribeFromLock ? (
                                        <button
                                            className={styles.zhimengSecondaryButton}
                                            onClick={onOpenBilling}
                                        >
                                            {'订阅解锁'}
                                        </button>
                                    ) : null}
                                    {onRefreshEntitlement ? (
                                        <button
                                            className={styles.zhimengSecondaryButton}
                                            onClick={onRefreshEntitlement}
                                        >
                                            {'刷新授权'}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </Box>
                )}
                <DragLayer />
            </Box>
        );
    }}</MediaQuery>);
};

GUIComponent.propTypes = {
    accountNavOpen: PropTypes.bool,
    activeTabIndex: PropTypes.number,
    authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false
    authorThumbnailUrl: PropTypes.string,
    authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false
    authActionError: PropTypes.string,
    authNotice: PropTypes.string,
    authStatus: PropTypes.string,
    backdropLibraryVisible: PropTypes.bool,
    backpackHost: PropTypes.string,
    backpackVisible: PropTypes.bool,
    billingError: PropTypes.string,
    billingModalOpen: PropTypes.bool,
    billingOrder: PropTypes.object,
    billingPaymentMethod: PropTypes.string,
    billingProofError: PropTypes.string,
    billingProofSubmitted: PropTypes.bool,
    billingSubmitting: PropTypes.bool,
    billingStatusRefreshing: PropTypes.bool,
    basePath: PropTypes.string,
    blocksTabVisible: PropTypes.bool,
    blocksId: PropTypes.string,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canCreateNew: PropTypes.bool,
    canEditTitle: PropTypes.bool,
    canManageFiles: PropTypes.bool,
    canRemix: PropTypes.bool,
    canSave: PropTypes.bool,
    canShare: PropTypes.bool,
    canUseCloud: PropTypes.bool,
    cardsVisible: PropTypes.bool,
    children: PropTypes.node,
    costumeLibraryVisible: PropTypes.bool,
    costumesTabVisible: PropTypes.bool,
    debugModalVisible: PropTypes.bool,
    enableCommunity: PropTypes.bool,
    entitlement: PropTypes.object,
    intl: intlShape.isRequired,
    isAppUnlocked: PropTypes.bool,
    isCreating: PropTypes.bool,
    isFullScreen: PropTypes.bool,
    isPlayerOnly: PropTypes.bool,
    isRtl: PropTypes.bool,
    isShared: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    loading: PropTypes.bool,
    logo: PropTypes.string,
    onActivateCostumesTab: PropTypes.func,
    onActivateSoundsTab: PropTypes.func,
    onActivateTab: PropTypes.func,
    onClickAccountNav: PropTypes.func,
    onClickLogo: PropTypes.func,
    onCloseAccountNav: PropTypes.func,
    onCloseBilling: PropTypes.func,
    onCloseLogin: PropTypes.func,
    onExtensionButtonClick: PropTypes.func,
    onLogOut: PropTypes.func,
    onOpenBilling: PropTypes.func,
    onOpenExternalBilling: PropTypes.func,
    onOpenLogin: PropTypes.func,
    onOpenStarterProject: PropTypes.func,
    onPaymentMethodChange: PropTypes.func,
    onRefreshBillingOrder: PropTypes.func,
    onRefreshEntitlement: PropTypes.func,
    onRequestCloseBackdropLibrary: PropTypes.func,
    onRequestCloseCostumeLibrary: PropTypes.func,
    onRequestCloseDebugModal: PropTypes.func,
    onRequestCloseTelemetryModal: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onShare: PropTypes.func,
    onShowPrivacyPolicy: PropTypes.func,
    onStartSelectingFileUpload: PropTypes.func,
    onTabSelect: PropTypes.func,
    onTelemetryModalCancel: PropTypes.func,
    onTelemetryModalOptIn: PropTypes.func,
    onTelemetryModalOptOut: PropTypes.func,
    onToggleLoginOpen: PropTypes.func,
    onSubmitPaymentProof: PropTypes.func,
    renderLogin: PropTypes.func,
    loginModalOpen: PropTypes.bool,
    showComingSoon: PropTypes.bool,
    soundsTabVisible: PropTypes.bool,
    stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),
    targetIsStage: PropTypes.bool,
    telemetryModalVisible: PropTypes.bool,
    theme: PropTypes.string,
    tipsLibraryVisible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};
GUIComponent.defaultProps = {
    backpackHost: null,
    backpackVisible: false,
    basePath: './',
    blocksId: 'original',
    canChangeLanguage: true,
    canChangeTheme: true,
    authActionError: '',
    authNotice: '',
    authStatus: 'signedOut',
    billingModalOpen: false,
    billingPaymentMethod: 'wechat',
    billingProofSubmitted: false,
    billingSubmitting: false,
    billingStatusRefreshing: false,
    canCreateNew: false,
    canEditTitle: false,
    canManageFiles: true,
    canRemix: false,
    canSave: false,
    canCreateCopy: false,
    canShare: false,
    canUseCloud: false,
    enableCommunity: false,
    isAppUnlocked: false,
    isCreating: false,
    isShared: false,
    isTotallyNormal: false,
    loading: false,
    onOpenStarterProject: () => {},
    onPaymentMethodChange: () => {},
    showComingSoon: false,
    stageSizeMode: STAGE_SIZE_MODES.large
};

const mapStateToProps = state => ({
    // This is the button's mode, as opposed to the actual current state
    blocksId: state.scratchGui.timeTravel.year.toString(),
    stageSizeMode: state.scratchGui.stageSize.stageSize,
    theme: state.scratchGui.theme.theme
});

export {
    GUIComponent
};

export default injectIntl(connect(
    mapStateToProps
)(GUIComponent));

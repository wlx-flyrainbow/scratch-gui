import React from 'react';
import VM from 'scratch-vm';

import {mountWithIntl} from '../../helpers/intl-helpers';

jest.mock('scratch-render', () => ({
    isSupported: () => true
}), {virtual: true});

jest.mock('../../../src/containers/blocks.jsx', () => 'Blocks');
jest.mock('../../../src/containers/costume-tab.jsx', () => 'CostumeTab');
jest.mock('../../../src/containers/target-pane.jsx', () => 'TargetPane');
jest.mock('../../../src/containers/sound-tab.jsx', () => 'SoundTab');
jest.mock('../../../src/containers/stage-wrapper.jsx', () => 'StageWrapper');
jest.mock('../../../src/containers/backpack.jsx', () => 'Backpack');
jest.mock('../../../src/containers/watermark.jsx', () => 'Watermark');
jest.mock('../../../src/containers/drag-layer.jsx', () => 'DragLayer');
jest.mock('../../../src/containers/modal.jsx', () => props => (
    <div className={props.className}>
        {props.children}
    </div>
));
jest.mock('../../../src/components/debug-modal/debug-modal.jsx', () => 'DebugModal');
jest.mock('../../../src/components/menu-bar/menu-bar.jsx', () => 'MenuBar');

import {GUIComponent} from '../../../src/components/gui/gui.jsx';

describe('GUIComponent', () => {
    const baseProps = {
        activeTabIndex: 0,
        isAppUnlocked: false,
        isRtl: false,
        loading: false,
        onOpenBilling: jest.fn(),
        onOpenLogin: jest.fn(),
        onRefreshEntitlement: jest.fn(),
        stageSizeMode: 'large',
        vm: new VM()
    };

    beforeEach(() => {
        if (!window.localStorage) {
            let storage = {};
            Object.defineProperty(window, 'localStorage', {
                value: {
                    clear: () => {
                        storage = {};
                    },
                    getItem: key => storage[key] || null,
                    setItem: (key, value) => {
                        storage[key] = value;
                    }
                }
            });
        }
        window.localStorage.clear();
    });

    test('shows locked experience instead of editor when app is not unlocked', () => {
        const component = mountWithIntl(
            <GUIComponent
                {...baseProps}
                authNotice="当前账号未开通订阅"
            />
        );

        expect(component.text()).toContain('少儿创意编程启蒙');
        expect(component.text()).toContain('当前账号未开通订阅');
        expect(component.text()).toContain('订阅解锁');
        expect(component.find('Tabs').exists()).toBe(false);
    });

    test('shows payment QR and proof form in subscription center', () => {
        const component = mountWithIntl(
            <GUIComponent
                {...baseProps}
                billingModalOpen
                billingOrder={{
                    amount_cents: 129900,
                    channel: 'wechat',
                    currency: 'CNY',
                    order_id: 'zm_20260523_001',
                    payment_note: '请备注订单号',
                    pay_url: 'https://example.com/pay',
                    qr_code_url: 'https://example.com/qr.png',
                    status: 'created'
                }}
                onRefreshBillingOrder={jest.fn()}
                onSubmitPaymentProof={jest.fn()}
            />
        );

        expect(component.text()).toContain('知萌订阅中心');
        expect(component.text()).toContain('zm_20260523_001');
        expect(component.text()).toContain('提交付款凭证');
        expect(component.find('img[alt="知萌收款二维码"]').prop('src')).toBe('https://example.com/qr.png');
        expect(component.text()).toContain('付款渠道');
        expect(component.text()).toContain('微信');
        expect(component.find('input[name="transfer_no"]').exists()).toBe(true);
        expect(component.find('input[name="trade_no_tail"]').exists()).toBe(true);
    });

    test('lets user choose payment channel before creating order', () => {
        const onOpenBilling = jest.fn();
        const component = mountWithIntl(
            <GUIComponent
                {...baseProps}
                billingModalOpen
                onOpenBilling={onOpenBilling}
            />
        );
        const form = component.find('form').last();
        expect(form.exists()).toBe(true);
        expect(form.find('select[name="channel"]').exists()).toBe(true);
        form.find('select[name="channel"]').getDOMNode().value = 'alipay';

        form.simulate('submit', {
            preventDefault: jest.fn()
        });

        expect(onOpenBilling).toHaveBeenCalledWith('alipay');
    });

    test('shows fulfilled order guidance while entitlement refresh is pending', () => {
        const component = mountWithIntl(
            <GUIComponent
                {...baseProps}
                billingModalOpen
                billingOrder={{
                    amount_cents: 19900,
                    currency: 'CNY',
                    order_id: 'zm_fulfilled',
                    status: 'fulfilled'
                }}
                onRefreshBillingOrder={jest.fn()}
                onSubmitPaymentProof={jest.fn()}
            />
        );

        expect(component.text()).toContain('订单已确认，授权刷新后将自动进入完整编辑器。');
        expect(component.text()).not.toContain('付款凭证已提交，等待运营核对到账后开通授权。');
    });

    test('opens specific starter project tutorials and records completion locally', () => {
        const onOpenStarterProject = jest.fn();
        const component = mountWithIntl(
            <GUIComponent
                {...baseProps}
                blocksTabVisible
                isAppUnlocked
                onOpenStarterProject={onOpenStarterProject}
                theme="default"
            />
        );

        expect(component.text()).toContain('会说话的小角色');
        expect(component.text()).toContain('生日祝福动画');
        expect(component.text()).toContain('接水果小游戏');

        component.find('button').filterWhere(button => (
            button.text().includes('会说话的小角色')
        )).first().simulate('click');

        expect(onOpenStarterProject).toHaveBeenCalledWith('talking_character');

        component.find('button').filterWhere(button => (
            button.text() === '完成了'
        )).first().simulate('click');
        component.update();

        expect(component.text()).toContain('已完成 1/3 个');
        expect(window.localStorage.getItem('zhimengStarterProjectProgress')).toContain('talking_character');
    });
});

import React from 'react';
import {mountWithIntl} from '../../helpers/intl-helpers';
import MenuBar from '../../../src/components/menu-bar/menu-bar';
import {menuInitialState} from '../../../src/reducers/menus';
import {LoadingState} from '../../../src/reducers/project-state';
import {DEFAULT_THEME} from '../../../src/lib/themes';

import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import VM from 'scratch-vm';

describe('MenuBar Component', () => {
    const makeStore = (overrides = {}) => configureStore()({
        locales: {
            isRtl: false,
            locale: 'en-US'
        },
        scratchGui: {
            menus: overrides.menus || menuInitialState,
            projectState: {
                loadingState: LoadingState.NOT_LOADED
            },
            theme: {
                theme: DEFAULT_THEME
            },
            timeTravel: {
                year: 'NOW'
            },
            vm: new VM()
        },
        session: overrides.session
    });

    const getComponent = function (props = {}) {
        const store = makeStore(props.storeOverrides);
        const {storeOverrides, ...componentProps} = props;
        return <Provider store={store}><MenuBar {...componentProps} /></Provider>;
    };

    test('menu bar with no About handler has no About button', () => {
        const menuBar = mountWithIntl(getComponent());
        const button = menuBar.find('AboutButton');
        expect(button.exists()).toBe(false);
    });

    test('menu bar with an About handler has an About button', () => {
        const onClickAbout = jest.fn();
        const menuBar = mountWithIntl(getComponent({onClickAbout}));
        const button = menuBar.find('AboutButton');
        expect(button.exists()).toBe(true);
    });

    test('clicking on About button calls the handler', () => {
        const onClickAbout = jest.fn();
        const menuBar = mountWithIntl(getComponent({onClickAbout}));
        const button = menuBar.find('AboutButton');
        expect(onClickAbout).toHaveBeenCalledTimes(0);
        button.simulate('click');
        expect(onClickAbout).toHaveBeenCalledTimes(1);
    });

    test('logged-in account menu shows Zhimeng subscription actions', () => {
        const menuBar = mountWithIntl(getComponent({
            authStatus: 'inactive',
            entitlement: {
                expires_at: '2026-12-31T00:00:00.000Z',
                plan: 'family_yearly',
                status: 'inactive'
            },
            onOpenBilling: jest.fn(),
            onRefreshEntitlement: jest.fn(),
            onLogOut: jest.fn(),
            storeOverrides: {
                menus: {
                    ...menuInitialState,
                    accountMenu: true
                },
                session: {
                    session: {
                        user: {
                            username: 'local_buyer'
                        }
                    }
                }
            }
        }));

        expect(menuBar.text()).toContain('local_buyer');
        expect(menuBar.text()).toContain('订阅状态');
        expect(menuBar.text()).toContain('未开通');
        expect(menuBar.text()).toContain('family_yearly');
        expect(menuBar.text()).toContain('2026-12-31T00:00:00.000Z');
        expect(menuBar.text()).toContain('订阅解锁');
        expect(menuBar.text()).toContain('刷新授权');
        expect(menuBar.text()).toContain('退出登录');
        expect(menuBar.text()).not.toContain('My Stuff');
    });
});

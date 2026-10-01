import path from 'path';
import webdriver from 'selenium-webdriver';
import SeleniumHelper from '../helpers/selenium-helper';
import {createEditorAuthBundle} from '../helpers/editor-auth-fixture';

const {getDriver, loadUri, findByXpath, findByText} = new SeleniumHelper();
const uri = path.resolve(__dirname, '../../build/index.html');
const lockedSelector = '//*[contains(@class, "gui_locked-experience")]';
let driver;

describe('Editor subscription gate', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    const lockedCases = [
        ['signed out', null, '登录并订阅后可进入完整编程编辑器'],
        ['inactive', createEditorAuthBundle({status: 'inactive'}), '当前订阅未生效或已到期'],
        ['expired', createEditorAuthBundle({status: 'expired'}), '当前订阅已到期'],
        ['frozen', createEditorAuthBundle({status: 'frozen'}), '当前账号已被冻结'],
        ['device limit', createEditorAuthBundle({status: 'deviceLimit'}), '当前账号最多可绑定 3 台设备'],
        ['expired offline lease', createEditorAuthBundle({expiredLease: true}), '授权租约已过期']
    ];
    lockedCases.forEach(([name, authBundle, notice]) => {
        test(`${name} keeps the editor locked`, async () => {
            await loadUri(uri, {authBundle});
            expect(await (await findByXpath(lockedSelector)).isDisplayed()).toBe(true);
            expect(await (await findByText(notice, '*[contains(@class, "gui_locked-experience")]'))
                .isDisplayed()).toBe(true);
            expect(await driver.findElements(webdriver.By.id('react-tabs-0'))).toHaveLength(0);
        });
    });

    test('an active offline lease opens the real editor', async () => {
        await loadUri(uri, {authBundle: createEditorAuthBundle()});
        expect(await (await findByText('Code')).isDisplayed()).toBe(true);
        expect(await (await findByText('Sounds')).isDisplayed()).toBe(true);
        expect(await driver.findElements(webdriver.By.xpath(lockedSelector))).toHaveLength(0);
    });
});

import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    clickXpath,
    findByText,
    getDriver,
    getLogs,
    loadUri
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

// The tests below require Scratch Link to be unavailable, so we can trigger
// an error modal. Fail both connection attempts asynchronously without relying
// on an external DNS name or a locally installed Scratch Link service.
const websocketFakeoutJs = `
    window.scratchLinkConnectionAttempts = [];
    window.WebSocket = class UnavailableWebSocket {
        constructor(url) {
            window.scratchLinkConnectionAttempts.push(url);
            this.readyState = 0;
            this.OPEN = 1;
            setTimeout(() => {
                this.readyState = 3;
                if (this.onerror) this.onerror(new Event('error'));
            }, 0);
        }
        close() { this.readyState = 3; }
        send() { throw new Error('Cannot send on the unavailable test socket'); }
    };
`;

describe('Hardware extension connection modal', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Message saying Scratch Link is unavailable (BLE)', async () => {
        await loadUri(uri);

        await driver.executeScript(websocketFakeoutJs);

        await clickXpath('//button[@title="Add Extension"]');

        await clickText('micro:bit');
        const notice = await findByText('Make sure you have Scratch Link installed and running');
        expect(await notice.isDisplayed()).toBe(true);
        expect(await driver.executeScript('return window.scratchLinkConnectionAttempts;')).toEqual([
            'ws://127.0.0.1:20111/scratch/ble',
            'wss://device-manager.scratch.mit.edu:20110/scratch/ble'
        ]);

        const logs = await getLogs();
        await expect(logs).toEqual([]);
    });

    test('Message saying Scratch Link is unavailable (BT)', async () => {
        await loadUri(uri);

        await driver.executeScript(websocketFakeoutJs);

        await clickXpath('//button[@title="Add Extension"]');

        await clickText('EV3');
        const notice = await findByText('Make sure you have Scratch Link installed and running');
        expect(await notice.isDisplayed()).toBe(true);
        expect(await driver.executeScript('return window.scratchLinkConnectionAttempts;')).toEqual([
            'ws://127.0.0.1:20111/scratch/bt',
            'wss://device-manager.scratch.mit.edu:20110/scratch/bt'
        ]);

        const logs = await getLogs();
        await expect(logs).toEqual([]);
    });
});

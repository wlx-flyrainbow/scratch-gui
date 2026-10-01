import http from 'http';
import path from 'path';
import webdriver from 'selenium-webdriver';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    findByText,
    getDriver,
    getLogs,
    loadUri
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;
let backpackServer;
let backpackHost;
let authorizedRequests = 0;

describe('Working with the licensed backpack', () => {
    beforeAll(async () => {
        driver = getDriver();
        backpackServer = http.createServer((request, response) => {
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.setHeader('Access-Control-Allow-Headers', 'x-token');
            response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            response.setHeader('Access-Control-Allow-Private-Network', 'true');
            if (request.method === 'OPTIONS') {
                response.writeHead(204);
                response.end();
                return;
            }
            if (request.method !== 'GET' ||
                !request.url.startsWith('/integration-user?') ||
                request.headers['x-token'] !== 'integration-offline-fixture') {
                response.writeHead(401);
                response.end();
                return;
            }
            authorizedRequests++;
            response.setHeader('Content-Type', 'application/json');
            response.end('[]');
        });
        await new Promise((resolve, reject) => {
            backpackServer.once('error', reject);
            backpackServer.listen(0, '127.0.0.1', resolve);
        });
        backpackHost = `http://127.0.0.1:${backpackServer.address().port}`;
    });

    afterAll(async () => {
        try {
            await driver.quit();
        } finally {
            if (backpackServer && backpackServer.listening) {
                await new Promise(resolve => backpackServer.close(resolve));
            }
        }
    });

    test('Backpack is hidden when no backpack service is configured', async () => {
        await loadUri(uri);
        expect(await (await findByText('Code')).isDisplayed()).toBe(true);
        expect(await driver.findElements(webdriver.By.xpath(
            '//*[contains(@class, "backpack_backpack-container")]'
        ))).toHaveLength(0);
        const logs = await getLogs();
        await expect(logs).toEqual([]);
    });

    test('A licensed session can load its backpack from the configured service', async () => {
        await loadUri(`${uri}?backpack_host=${backpackHost}`);

        // Try activating the backpack from the costumes tab to make sure it isn't pushed off
        await clickText('Costumes');

        // Check that the backpack header is visible and wrapped in a coming soon tooltip
        await clickText('Backpack'); // Not wrapped in tooltip
        await clickText('Backpack is empty'); // Make sure it can expand, is empty
        expect(authorizedRequests).toBeGreaterThan(0);
        const logs = await getLogs();
        await expect(logs).toEqual([]);
    });
});

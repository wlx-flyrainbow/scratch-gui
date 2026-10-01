import SeleniumHelper, {enhanceError} from '../../helpers/selenium-helper';

describe('Selenium browser error reporting', () => {
    const helperWithLogs = entries => {
        const helper = new SeleniumHelper();
        helper.driver = {
            executeScript: () => Promise.resolve(),
            manage: () => ({logs: () => ({get: () => Promise.resolve(entries)})})
        };
        return helper;
    };

    test('preserves severe errors represented by WebDriver level objects', async () => {
        const error = {level: {name: 'SEVERE', value: 1000}, message: 'editor failed'};
        const warning = {level: {name: 'WARNING', value: 900}, message: 'non-fatal warning'};
        expect(await helperWithLogs([warning, error]).getLogs()).toEqual([error]);
    });

    test('an empty whitelist still excludes non-errors and keeps severe string levels', async () => {
        const error = {level: 'SEVERE', message: 'request failed'};
        expect(await helperWithLogs([{level: 'INFO', message: 'ready'}, error]).getLogs([]))
            .toEqual([error]);
    });

    test('only explicitly allowed errors are omitted', async () => {
        const allowed = {level: {name: 'SEVERE'}, message: 'known media cancellation'};
        const error = {level: {name: 'SEVERE'}, message: 'unrelated failure'};
        expect(await helperWithLogs([allowed, error]).getLogs(['known media cancellation']))
            .toEqual([error]);
    });

    test('large inline assets cannot overwhelm the original browser failure', async () => {
        const driver = {
            getCurrentUrl: jest.fn(() => Promise.resolve('file:///editor/index.html')),
            getTitle: () => Promise.resolve('Editor'),
            getPageSource: jest.fn(() => Promise.resolve(
                `<style>${'x'.repeat(1000000)}</style><body><button>Missing extension</button>` +
                `<img src="data:image/png;base64,${'x'.repeat(1000000)}">${'x'.repeat(30000)}</body>`
            )),
            executeScript: () => Promise.resolve('Missing extension'),
            manage: () => ({logs: () => ({get: () => Promise.resolve([])})})
        };
        const error = await enhanceError(new Error('find failed'), new Error('element timed out'), driver);
        const wrapped = await enhanceError(new Error('click failed'), error, driver);
        expect(wrapped.message).toContain('element timed out');
        expect(wrapped.message).toContain('Missing extension');
        expect(wrapped.message).toContain('[diagnostic truncated]');
        expect(wrapped.message.length).toBeLessThan(48000);
        expect(driver.getPageSource).toHaveBeenCalledTimes(1);
    });
});

// some server-side things don't fully fail until a 90-second timeout
// allow time for that so we get a more specific error message
jest.setTimeout(95000); // eslint-disable-line no-undef

import bindAll from 'lodash.bindall';
import webdriver from 'selenium-webdriver';
import {editorAuthBundle} from './editor-auth-fixture';

const {Button, By, until} = webdriver;

const USE_HEADLESS = process.env.USE_HEADLESS !== 'no';

// The main reason for this timeout is so that we can control the timeout message and report details;
// if we hit the Jasmine default timeout then we get a terse message that we can't control.
// The Jasmine default timeout is 30 seconds so make sure this is lower.
const DEFAULT_TIMEOUT_MILLISECONDS = 20 * 1000;

const limitDiagnostic = (value, maximum = 12000) => {
    const text = String(value);
    return text.length > maximum ? `${text.slice(0, maximum)}\n[diagnostic truncated]` : text;
};

/**
 * Add more debug information to an error:
 * - Merge a causal error into an outer error with valuable stack information
 * - Add the causal error's message to the outer error's message.
 * - Add debug information from the web driver, if available.
 * The outerError compensates for the loss of context caused by `regenerator-runtime`.
 * @param {Error} outerError The error to embed the cause into.
 * @param {Error} cause The "inner" error to embed.
 * @param {webdriver.ThenableWebDriver} [driver] Optional driver to capture debug info from.
 * @returns {Promise<Error>} The outerError, with the cause embedded.
 */
const enhanceError = async (outerError, cause, driver) => {
    if (cause) {
        // This is the official way to nest errors in modern Node.js, but Jest ignores this field.
        // It's here in case a future version uses it, or in case the caller does.
        outerError.cause = cause;
    }
    if (cause && cause.message) {
        outerError.message += `\n${['Cause:', ...limitDiagnostic(cause.message, 48000).split('\n')].join('\n    ')}`;
    } else {
        outerError.message += '\nCause: unknown';
    }
    if (driver && !(cause && cause.browserDiagnosticsCaptured)) {
        const url = await driver.getCurrentUrl();
        const title = await driver.getTitle();
        const pageSource = await driver.getPageSource();
        const visibleText = await driver.executeScript('return document.body ? document.body.innerText : "";');
        const browserLogEntries = await driver.manage()
            .logs()
            .get('browser');
        const browserLogText = browserLogEntries.map(entry => entry.message).join('\n');
        outerError.message += `\nBrowser URL: ${url}`;
        outerError.message += `\nBrowser title: ${title}`;
        const compactSource = pageSource
            .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
            .replace(/data:[^"'\s<>]+/g, '[inline data omitted]');
        outerError.message += `\nBrowser logs:\n*****\n${limitDiagnostic(browserLogText)}\n*****\n`;
        outerError.message += `\nVisible page text:\n*****\n${limitDiagnostic(visibleText)}\n*****\n`;
        outerError.message += `\nBrowser page source (without scripts/styles/inline data):\n*****\n` +
            `${limitDiagnostic(compactSource, 20000)}\n*****\n`;
        outerError.browserDiagnosticsCaptured = true;
    } else if (cause && cause.browserDiagnosticsCaptured) {
        outerError.browserDiagnosticsCaptured = true;
    }
    return outerError;
};

class SeleniumHelper {
    constructor () {
        bindAll(this, [
            'clickText',
            'clickButton',
            'clickXpath',
            'clickBlocksCategory',
            'elementIsVisible',
            'findByText',
            'textToXpath',
            'findByXpath',
            'textExists',
            'getDriver',
            'getSauceDriver',
            'getLogs',
            'loadUri',
            'rightClickText'
        ]);

        this.Key = webdriver.Key; // map Key constants, for sending special keys

        // this type declaration suppresses IDE type warnings throughout this file
        /** @type {webdriver.ThenableWebDriver} */
        this.driver = null;
    }

    /**
     * Set the browser window title. Useful for debugging.
     * @param {string} title The title to set.
     * @returns {Promise<void>} A promise that resolves when the title is set.
     */
    async setTitle (title) {
        await this.driver.executeScript(`document.title = arguments[0];`, title);
    }

    /**
     * Wait for an element to be visible.
     * @param {webdriver.WebElement} element The element to wait for.
     * @returns {Promise<void>} A promise that resolves when the element is visible.
     */
    async elementIsVisible (element) {
        const outerError = new Error('elementIsVisible failed');
        try {
            await this.setTitle(`elementIsVisible ${await element.getId()}`);
            await this.driver.wait(until.elementIsVisible(element), DEFAULT_TIMEOUT_MILLISECONDS);
        } catch (cause) {
            throw await enhanceError(outerError, cause, this.driver);
        }
    }

    /**
     * List of useful xpath scopes for finding elements.
     * @returns {object} An object mapping names to xpath strings.
     */
    get scope () {
        return {
            blocksTab: "*[@id='react-tabs-1']",
            costumesTab: "*[@id='react-tabs-3']",
            modal: '*[@class="ReactModalPortal"]',
            reportedValue: '*[@class="blocklyDropDownContent"]',
            soundsTab: "*[@id='react-tabs-5']",
            spriteTile: '*[starts-with(@class,"react-contextmenu-wrapper")]',
            menuBar: '*[contains(@class,"menu-bar_menu-bar_")]',
            monitors: '*[starts-with(@class,"stage_monitor-wrapper")]',
            // The menu adds its visible class before two animation frames position
            // it and enable pointer events. Clicking sooner scrolls and closes it.
            contextMenu: '*[contains(@class,"react-contextmenu--visible")' +
                ' and contains(@style,"pointer-events: auto")]'
        };
    }

    /**
     * Instantiate a new Selenium driver.
     * @returns {webdriver.ThenableWebDriver} The new driver.
     */
    getDriver () {
        const chromeCapabilities = webdriver.Capabilities.chrome();
        const args = [];
        if (USE_HEADLESS) {
            args.push('--headless');
            // Headless CI has no physical GPU. Explicit software WebGL is required
            // by recent Chrome versions for the trusted editor under test.
            args.push('--enable-unsafe-swiftshader');
        }

        // Stub getUserMedia to always not allow access
        args.push('--use-fake-ui-for-media-stream=deny');

        // Suppress complaints about AudioContext starting before a user gesture
        // This is especially important on Windows, where Selenium directs JS console messages to stdout
        args.push('--autoplay-policy=no-user-gesture-required');

        chromeCapabilities.set('chromeOptions', {args, prefs: {'intl.accept_languages': 'en-US,en'}});
        chromeCapabilities.setLoggingPrefs({
            performance: 'ALL'
        });
        this.driver = new webdriver.Builder()
            .forBrowser('chrome')
            .withCapabilities(chromeCapabilities)
            .build();
        return this.driver;
    }

    /**
     * Instantiate a new Selenium driver for Sauce Labs.
     * @param {string} username The Sauce Labs username.
     * @param {string} accessKey The Sauce Labs access key.
     * @param {object} configs The Sauce Labs configuration.
     * @param {string} configs.browserName The name of the desired browser.
     * @param {string} configs.platform The name of the desired platform.
     * @param {string} configs.version The desired browser version.
     * @returns {webdriver.ThenableWebDriver} The new driver.
     */
    getSauceDriver (username, accessKey, configs) {
        this.driver = new webdriver.Builder()
            .withCapabilities({
                browserName: configs.browserName,
                platform: configs.platform,
                version: configs.version,
                username: username,
                accessKey: accessKey
            })
            .usingServer(`http://${username}:${accessKey}@ondemand.saucelabs.com:80/wd/hub`)
            .build();
        return this.driver;
    }

    /**
     * Find an element by xpath.
     * @param {string} xpath The xpath to search for.
     * @returns {Promise<webdriver.WebElement>} A promise that resolves to the element.
     */
    async findByXpath (xpath) {
        const outerError = new Error(`findByXpath failed with arguments:\n\txpath: ${xpath}`);
        try {
            await this.setTitle(`findByXpath ${xpath}`);
            const el = await this.driver.wait(until.elementLocated(By.xpath(xpath)), DEFAULT_TIMEOUT_MILLISECONDS);
            // await this.driver.wait(() => el.isDisplayed(), DEFAULT_TIMEOUT_MILLISECONDS);
            return el;
        } catch (cause) {
            throw await enhanceError(outerError, cause, this.driver);
        }
    }

    /**
     * Generate an xpath that finds an element by its text.
     * @param {string} text The text to search for.
     * @param {string} [scope] An optional xpath scope to search within.
     * @returns {string} The xpath.
     */
    textToXpath (text, scope) {
        return `//body//${scope || '*'}//*[contains(text(), '${text}')]`;
    }

    /**
     * Find an element by its text.
     * @param {string} text The text to search for.
     * @param {string} [scope] An optional xpath scope to search within.
     * @returns {Promise<webdriver.WebElement>} A promise that resolves to the element.
     */
    findByText (text, scope) {
        return this.findByXpath(this.textToXpath(text, scope));
    }

    /**
     * Check if an element exists by its text.
     * @param {string} text The text to search for.
     * @param {string} [scope] An optional xpath scope to search within.
     * @returns {Promise<boolean>} A promise that resolves to true if the element exists.
     */
    async textExists (text, scope) {
        const outerError = new Error(`textExists failed with arguments:\n\ttext: ${text}\n\tscope: ${scope}`);
        try {
            await this.setTitle(`textExists ${text}`);
            const elements = await this.driver.findElements(By.xpath(this.textToXpath(text, scope)));
            return elements.length > 0;
        } catch (cause) {
            throw await enhanceError(outerError, cause, this.driver);
        }
    }

    /**
     * Load a URI in the driver.
     * @param {string} uri The URI to load.
     * @param {object} options Test session configuration; authBundle=null tests signed-out behavior.
     * @returns {Promise} A promise that resolves when the URI is loaded.
     */
    async loadUri (uri, {authBundle = editorAuthBundle} = {}) {
        const outerError = new Error(`loadUri failed with arguments:\n\turi: ${uri}`);
        try {
            await this.setTitle(`loadUri ${uri}`);
            // TODO: The height is set artificially high to fix this test:
            // 'Loading with locale shows correct translation for string length block parameter'
            // which fails because the block is offscreen.
            // We should set this back to 1024x768 once we find a good way to fix that test.
            // Using `scrollIntoView` didn't seem to do the trick.
            const WINDOW_WIDTH = 1024;
            const WINDOW_HEIGHT = 960;
            await this.driver
                .get(`file://${uri}`);
            await this.driver
                .executeScript('window.onbeforeunload = undefined;');
            const sessionChanged = await this.driver.executeScript((bundle => {
                const next = bundle ? JSON.stringify(bundle) : null;
                const previous = window.localStorage.getItem('zhimeng-auth');
                if (next === previous) return false;
                if (next) {
                    window.localStorage.setItem('zhimeng-auth', next);
                } else {
                    window.localStorage.removeItem('zhimeng-auth');
                }
                return true;
            }), authBundle);
            if (sessionChanged) {
                await this.driver.navigate().refresh();
                await this.driver.executeScript('window.onbeforeunload = undefined;');
            }
            await this.driver.manage().window()
                .setSize(WINDOW_WIDTH, WINDOW_HEIGHT);
            await this.driver.wait(
                async () => await this.driver.executeScript('return document.readyState;') === 'complete',
                DEFAULT_TIMEOUT_MILLISECONDS
            );
        } catch (cause) {
            throw await enhanceError(outerError, cause, this.driver);
        }
    }

    /**
     * Click an element by xpath.
     * @param {string} xpath The xpath to click.
     * @returns {Promise<void>} A promise that resolves when the element is clicked.
     */
    async clickXpath (xpath) {
        const outerError = new Error(`clickXpath failed with arguments:\n\txpath: ${xpath}`);
        try {
            await this.setTitle(`clickXpath ${xpath}`);
            const el = await this.findByXpath(xpath);
            await el.click();
        } catch (cause) {
            throw await enhanceError(outerError, cause, this.driver);
        }
    }

    /**
     * Click an element by its text.
     * @param {string} text The text to click.
     * @param {string} [scope] An optional xpath scope to search within.
     * @returns {Promise<void>} A promise that resolves when the element is clicked.
     */
    async clickText (text, scope) {
        const outerError = new Error(`clickText failed with arguments:\n\ttext: ${text}\n\tscope: ${scope}`);
        try {
            await this.setTitle(`clickText ${text}`);
            const el = await this.findByText(text, scope);
            await el.click();
        } catch (cause) {
            throw await enhanceError(outerError, cause, this.driver);
        }
    }

    /**
     * Click a category in the blocks pane.
     * @param {string} categoryText The text of the category to click.
     * @returns {Promise<void>} A promise that resolves when the category is clicked.
     */
    async clickBlocksCategory (categoryText) {
        const outerError = new Error(`clickBlocksCategory failed with arguments:\n\tcategoryText: ${categoryText}`);
        // The toolbox is destroyed and recreated several times, so avoid clicking on a nonexistent element and erroring
        // out. First we wait for the block pane itself to appear, then wait 100ms for the toolbox to finish refreshing,
        // then finally click the toolbox text.
        try {
            await this.setTitle(`clickBlocksCategory ${categoryText}`);
            await this.findByXpath('//div[contains(@class, "blocks_blocks")]');
            await this.driver.sleep(100);
            await this.clickText(categoryText, 'div[contains(@class, "blocks_blocks")]');
            await this.driver.sleep(500); // Wait for scroll to finish
        } catch (cause) {
            throw await enhanceError(outerError, cause);
        }
    }

    /**
     * Right click an element by its text.
     * @param {string} text The text to right click.
     * @param {string} [scope] An optional xpath scope to search within.
     * @returns {Promise<void>} A promise that resolves when the element is right clicked.
     */
    async rightClickText (text, scope) {
        const outerError = new Error(`rightClickText failed with arguments:\n\ttext: ${text}\n\tscope: ${scope}`);
        try {
            await this.setTitle(`rightClickText ${text}`);
            const el = await this.findByText(text, scope);
            await this.driver.actions()
                .click(el, Button.RIGHT)
                .perform();
        } catch (cause) {
            throw await enhanceError(outerError, cause, this.driver);
        }
    }

    /**
     * Click a button by its text.
     * @param {string} text The text to click.
     * @returns {Promise<void>} A promise that resolves when the button is clicked.
     */
    async clickButton (text) {
        const outerError = new Error(`clickButton failed with arguments:\n\ttext: ${text}`);
        try {
            await this.setTitle(`clickButton ${text}`);
            await this.clickXpath(`//button//*[contains(text(), '${text}')]`);
        } catch (cause) {
            throw await enhanceError(outerError, cause, this.driver);
        }
    }

    /**
     * Get selected browser log entries.
     * @param {Array.<string>} [whitelist] An optional list of log strings to allow. Default: see implementation.
     * @returns {Promise<Array.<webdriver.logging.Entry>>} A promise that resolves to the log entries.
     */
    async getLogs (whitelist) {
        const outerError = new Error(`getLogs failed with arguments:\n\twhitelist: ${whitelist}`);
        try {
            await this.setTitle(`getLogs ${whitelist}`);
            if (!whitelist) {
                // Default whitelist
                whitelist = [
                    'The play() request was interrupted by a call to pause()'
                ];
            }
            const entries = await this.driver.manage()
                .logs()
                .get('browser');
            return entries.filter(entry => {
                const message = entry.message;
                for (const element of whitelist) {
                    if (message.indexOf(element) !== -1) {
                        return false;
                    }
                }
                const level = entry.level && entry.level.name ? entry.level.name : entry.level;
                return level === 'SEVERE';
            });
        } catch (cause) {
            throw await enhanceError(outerError, cause);
        }
    }
}

export default SeleniumHelper;
export {enhanceError};

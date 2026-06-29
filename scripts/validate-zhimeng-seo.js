const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];

const siteOrigin = 'https://zhimeng.codevalley.cn';

const readText = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const exists = relativePath => fs.existsSync(path.join(root, relativePath));

const addFailure = (id, message) => {
    failures.push({id, message});
};

const requireIncludes = (id, haystack, needle) => {
    if (!haystack.includes(needle)) {
        addFailure(id, `${id} must include ${JSON.stringify(needle)}`);
    }
};

const requireFile = relativePath => {
    if (!exists(relativePath)) {
        addFailure(relativePath, `${relativePath} must exist`);
        return false;
    }
    return true;
};

const hasTagAttribute = (html, tag, attr, value) => {
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<${tag}\\s+[^>]*${attr}=["']${escapedValue}["'][^>]*>`, 'i');
    return pattern.test(html);
};

const requireTagAttribute = (id, html, tag, attr, value) => {
    if (!hasTagAttribute(html, tag, attr, value)) {
        addFailure(id, `${id} must include <${tag}> with ${attr}=${JSON.stringify(value)}`);
    }
};

const extractJsonLd = (relativePath, html) => {
    const matches = Array.from(html.matchAll(
        /<script\s+type=["']application\/ld\+json["']\s*>([\s\S]*?)<\/script>/gi
    ));
    if (matches.length === 0) {
        addFailure(relativePath, `${relativePath} must include JSON-LD`);
        return [];
    }
    return matches.map((match, index) => {
        try {
            return JSON.parse(match[1]);
        } catch (err) {
            addFailure(`${relativePath}.jsonld.${index}`, `invalid JSON-LD: ${err.message}`);
            return null;
        }
    }).filter(Boolean);
};

const collectTypes = value => {
    const types = new Set();
    const visit = item => {
        if (!item || typeof item !== 'object') return;
        const type = item['@type'];
        if (Array.isArray(type)) {
            type.forEach(entry => types.add(entry));
        } else if (type) {
            types.add(type);
        }
        if (Array.isArray(item['@graph'])) {
            item['@graph'].forEach(visit);
        }
    };
    if (Array.isArray(value)) {
        value.forEach(visit);
    } else {
        visit(value);
    }
    return types;
};

const requireJsonLdTypes = (relativePath, html, expectedTypes) => {
    const docs = extractJsonLd(relativePath, html);
    const types = new Set();
    docs.forEach(doc => {
        collectTypes(doc).forEach(type => types.add(type));
    });
    expectedTypes.forEach(type => {
        if (!types.has(type)) {
            addFailure(relativePath, `${relativePath} JSON-LD must include @type ${type}`);
        }
    });
};

const stripScriptContent = html => html.replace(/<script[\s\S]*?<\/script>/gi, '');

const forbiddenPublicCopyTerms = [
    'API 地址',
    'V0',
    '灰度',
    '授权检查',
    '购买归因',
    '订单归因',
    '客服辅助',
    'MVP',
    '跑通',
    '运营台',
    '佣金成本',
    '创建订单',
    '内测'
];

const checkPublicPage = page => {
    if (!requireFile(page.path)) return;
    const html = readText(page.path);
    requireIncludes(page.path, html, '<title>');
    requireTagAttribute(page.path, html, 'meta', 'name', 'description');
    requireTagAttribute(page.path, html, 'link', 'rel', 'canonical');
    [
        'og:type',
        'og:title',
        'og:description',
        'og:url',
        'og:image'
    ].forEach(property => {
        requireTagAttribute(page.path, html, 'meta', 'property', property);
    });
    [
        'twitter:card',
        'twitter:title',
        'twitter:description',
        'twitter:image'
    ].forEach(name => {
        requireTagAttribute(page.path, html, 'meta', 'name', name);
    });
    requireJsonLdTypes(page.path, html, page.jsonLdTypes);
    if (page.requiresFaq && !html.includes('faq-section')) {
        addFailure(page.path, `${page.path} must include visible FAQ content`);
    }
    const visibleCopy = stripScriptContent(html);
    forbiddenPublicCopyTerms.forEach(term => {
        if (visibleCopy.includes(term)) {
            addFailure(page.path, `${page.path} public copy must not include internal term ${term}`);
        }
    });
};

const checkPurchasePage = () => {
    const relativePath = 'website/purchase.html';
    if (!requireFile(relativePath)) return;
    const html = readText(relativePath);
    requireTagAttribute(relativePath, html, 'meta', 'name', 'robots');
    requireIncludes(relativePath, html, 'noindex,nofollow');
    requireJsonLdTypes(relativePath, html, ['Product', 'FAQPage']);
    requireIncludes(relativePath, html, '正式购买请在新祥编程客户端');
};

const checkRobotsAndSitemap = () => {
    if (!requireFile('website/robots.txt') || !requireFile('website/sitemap.xml')) return;
    const robots = readText('website/robots.txt');
    requireIncludes('website.robots', robots, `Sitemap: ${siteOrigin}/sitemap.xml`);
    requireIncludes('website.robots', robots, 'Disallow: /ops.html');
    requireIncludes('website.robots', robots, 'Disallow: /purchase.html');

    const sitemap = readText('website/sitemap.xml');
    [
        `${siteOrigin}/`,
        `${siteOrigin}/index.html`,
        `${siteOrigin}/teacher.html`,
        `${siteOrigin}/app.html`
    ].forEach(url => {
        requireIncludes('website.sitemap', sitemap, `<loc>${url}</loc>`);
    });
    if (sitemap.includes('/purchase.html')) {
        addFailure('website.sitemap', 'sitemap must not include noindex purchase.html');
    }
    if (sitemap.includes('/ops.html')) {
        addFailure('website.sitemap', 'sitemap must not include internal ops.html');
    }
};

const checkQuestionMap = () => {
    const relativePath = 'docs/zhimeng-geo-question-map.csv';
    if (!requireFile(relativePath)) return;
    const lines = readText(relativePath)
        .trim()
        .split(/\r?\n/);
    const header = lines[0] || '';
    const headerColumns = header.split(',');
    [
        'question',
        'audience',
        'intent',
        'current_ai_answer',
        'mentioned_zhimeng',
        'target_page',
        'priority',
        'checked_at'
    ].forEach(column => {
        if (!headerColumns.includes(column)) {
            addFailure(relativePath, `${relativePath} header must include ${column}`);
        }
    });
    if (lines.length < 21) {
        addFailure(relativePath, `${relativePath} must include at least 20 questions plus header`);
    }
};

[
    {
        path: 'website/index.html',
        jsonLdTypes: ['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage'],
        requiresFaq: true
    },
    {
        path: 'website/teacher.html',
        jsonLdTypes: ['Organization', 'WebPage', 'Product', 'FAQPage'],
        requiresFaq: true
    },
    {
        path: 'website/app.html',
        jsonLdTypes: ['Organization', 'WebApplication', 'FAQPage'],
        requiresFaq: true
    }
].forEach(checkPublicPage);

checkPurchasePage();
checkRobotsAndSitemap();
checkQuestionMap();

if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Zhimeng SEO/GEO check failed:');
    failures.forEach(failure => {
        // eslint-disable-next-line no-console
        console.error(`- ${failure.id}: ${failure.message}`);
    });
    process.exit(1);
}

// eslint-disable-next-line no-console
console.log('Zhimeng SEO/GEO check passed.');

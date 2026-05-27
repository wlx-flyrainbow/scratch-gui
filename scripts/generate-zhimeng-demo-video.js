#!/usr/bin/env node
/* eslint-disable */

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const width = 1920;
const height = 1080;
const fps = 24;
const duration = 30;
const frameCount = fps * duration;
const framesDir = path.join(root, '.tmp', 'zhimeng-demo-video-frames');
const outputDir = path.join(root, 'website', 'assets', 'videos');
const outputVideo = path.join(outputDir, 'zhimeng-demo-30s.mp4');
const logoPath = path.join(root, 'website', 'assets', 'logo.png');

const ffmpegPath = process.env.FFMPEG_PATH ||
  process.env.npm_config_ffmpeg_path ||
  findFfmpeg();

function findFfmpeg () {
  const candidates = [
    '/tmp/zhimeng-video-tools/node_modules/ffmpeg-static/ffmpeg',
    path.join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const found = spawnSync('which', ['ffmpeg'], {encoding: 'utf8'});
  return found.status === 0 ? found.stdout.trim() : '';
}

function esc (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clamp (value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function ease (value) {
  const t = clamp(value);
  return t * t * (3 - (2 * t));
}

function sceneProgress (time, start, end) {
  return clamp((time - start) / (end - start));
}

function fadeForScene (time, start, end) {
  return Math.min(ease(sceneProgress(time, start, start + 0.7)), ease(sceneProgress(end - time, 0, 0.7)));
}

function roundedRect (x, y, w, h, r, fill, stroke = 'none', sw = 0, opacity = 1) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
}

function line (x1, y1, x2, y2, stroke, sw = 2, opacity = 1) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
}

function textBlock (lines, x, y, opts = {}) {
  const {
    size = 48,
    weight = 800,
    fill = '#18162f',
    lineHeight = Math.round(size * 1.35),
    anchor = 'start',
    opacity = 1
  } = opts;

  const tspans = lines.map((item, index) => {
    const dy = index === 0 ? 0 : lineHeight;
    return `<tspan x="${x}" dy="${dy}">${esc(item)}</tspan>`;
  }).join('');

  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}" opacity="${opacity}">${tspans}</text>`;
}

function pill (label, x, y, w, fill, color, opacity = 1) {
  return [
    roundedRect(x, y, w, 64, 32, fill, 'none', 0, opacity),
    textBlock([label], x + (w / 2), y + 42, {
      size: 28,
      weight: 900,
      fill: color,
      anchor: 'middle',
      opacity
    })
  ].join('');
}

function header (opacity = 1) {
  return `
    <g opacity="${opacity}">
      ${roundedRect(90, 76, 120, 120, 30, '#ffffff', '#ded8f1', 2)}
      <image href="data:image/png;base64,${logoBase64}" x="93" y="79" width="114" height="114" preserveAspectRatio="xMidYMid slice"/>
      ${textBlock(['新祥编程'], 238, 125, {size: 58, weight: 950})}
      ${textBlock(['少儿创意编程启蒙'], 240, 172, {size: 28, weight: 800, fill: '#646078'})}
      ${pill('6-10 岁', 1640, 106, 180, '#e8f5e9', '#1f6b31')}
    </g>
  `;
}

function footer (time) {
  return `
    <g opacity="0.88">
      ${textBlock(['首发阶段：下载客户端 -> 注册登录 -> 订阅解锁 -> 提交凭证 -> 确认后刷新授权'], 90, 1012, {
        size: 28,
        weight: 800,
        fill: '#646078'
      })}
      ${textBlock(['家庭年卡 199 元/年'], 1830, 1012, {
        size: 28,
        weight: 950,
        fill: '#6b4dff',
        anchor: 'end'
      })}
    </g>
  `;
}

function editorMock (x, y, scale, time, opacity = 1) {
  const sw = 1180 * scale;
  const sh = 660 * scale;
  const charX = x + (810 + (Math.sin(time * 2.6) * 32)) * scale;
  const charY = y + (340 + (Math.cos(time * 2.2) * 18)) * scale;
  const block = (bx, by, bw, label, fill) => `
    ${roundedRect(x + bx * scale, y + by * scale, bw * scale, 48 * scale, 12 * scale, fill)}
    ${textBlock([label], x + (bx + 22) * scale, y + (by + 32) * scale, {
      size: 21 * scale,
      weight: 900,
      fill: '#ffffff'
    })}
  `;

  return `
    <g opacity="${opacity}">
      ${roundedRect(x, y, sw, sh, 24 * scale, '#ffffff', '#ded8f1', 2)}
      ${roundedRect(x, y, sw, 72 * scale, 24 * scale, '#7b58db')}
      ${textBlock(['新祥编程作品'], x + 490 * scale, y + 47 * scale, {size: 25 * scale, weight: 900, fill: '#ffffff'})}
      ${roundedRect(x + 22 * scale, y + 96 * scale, 248 * scale, 532 * scale, 18 * scale, '#f6f9ff', '#e1e6f2', 2)}
      ${block(48, 132, 165, '移动 10 步', '#3f8cf5')}
      ${block(48, 198, 190, '右转 15 度', '#3f8cf5')}
      ${block(48, 264, 210, '说 你好！', '#8a5ce6')}
      ${block(48, 330, 225, '当绿旗被点击', '#f1aa2b')}
      ${roundedRect(x + 300 * scale, y + 96 * scale, 440 * scale, 532 * scale, 18 * scale, '#fbfcff', '#e1e6f2', 2)}
      ${roundedRect(x + 780 * scale, y + 96 * scale, 372 * scale, 388 * scale, 18 * scale, '#ffffff', '#dbe2ed', 2)}
      ${line(x + 818 * scale, y + 136 * scale, x + 1112 * scale, y + 136 * scale, '#eff3f8', 4)}
      ${line(x + 818 * scale, y + 444 * scale, x + 1112 * scale, y + 444 * scale, '#eff3f8', 4)}
      <circle cx="${x + 928 * scale}" cy="${y + 286 * scale}" r="${76 * scale}" fill="#fff4d5" stroke="#f0c66a" stroke-width="${3 * scale}"/>
      <circle cx="${charX}" cy="${charY}" r="${38 * scale}" fill="#f4a62a"/>
      <path d="M ${charX - 26 * scale} ${charY - 38 * scale} C ${charX - 80 * scale} ${charY - 96 * scale}, ${charX - 20 * scale} ${charY - 116 * scale}, ${charX + 6 * scale} ${charY - 62 * scale}" fill="#66bd68"/>
      <path d="M ${charX + 18 * scale} ${charY - 46 * scale} C ${charX + 70 * scale} ${charY - 110 * scale}, ${charX + 122 * scale} ${charY - 70 * scale}, ${charX + 42 * scale} ${charY - 34 * scale}" fill="#66bd68"/>
      ${roundedRect(x + 780 * scale, y + 508 * scale, 372 * scale, 120 * scale, 18 * scale, '#eef8ff', '#dbe2ed', 2)}
      ${textBlock(['角色正在移动，并说：你好！'], x + 810 * scale, y + 578 * scale, {size: 24 * scale, weight: 900, fill: '#2f6fa3'})}
    </g>
  `;
}

function qrMock (x, y, size, opacity = 1) {
  const cells = 9;
  const cell = size / cells;
  let content = roundedRect(x, y, size, size, 12, '#ffffff', '#d3d7df', 2, opacity);
  const pattern = [
    [1,1,1,0,1,0,1,1,1],
    [1,0,1,0,0,1,1,0,1],
    [1,1,1,1,0,1,1,1,1],
    [0,1,0,1,1,0,0,1,0],
    [1,0,1,0,1,1,1,0,1],
    [0,1,0,1,0,0,1,1,0],
    [1,1,1,0,1,0,1,1,1],
    [1,0,1,1,0,1,1,0,1],
    [1,1,1,0,1,1,1,1,1]
  ];
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      if (pattern[row][col]) {
        content += roundedRect(
          x + 18 + (col * (cell - 4)),
          y + 18 + (row * (cell - 4)),
          cell - 10,
          cell - 10,
          2,
          '#151225',
          'none',
          0,
          opacity
        );
      }
    }
  }
  return content;
}

function sceneIntro (time, opacity) {
  const p = ease(sceneProgress(time, 0, 4));
  const y = 320 - (22 * p);
  return `
    <g opacity="${opacity}">
      ${textBlock(['想让孩子试试编程，', '不一定先报高价课'], 90, y, {
        size: 82,
        weight: 950,
        fill: '#18162f',
        lineHeight: 105
      })}
      ${textBlock(['新祥编程把入口收窄到孩子能理解的创作：', '一个角色、一个故事、一个小游戏。'], 94, y + 250, {
        size: 38,
        weight: 800,
        fill: '#646078',
        lineHeight: 58
      })}
      ${pill('家庭低成本编程启蒙', 94, y + 410, 340, '#efeaff', '#6b4dff')}
    </g>
  `;
}

function sceneEditor (time, opacity) {
  const p = ease(sceneProgress(time, 4, 10));
  return `
    <g opacity="${opacity}">
      ${textBlock(['用积木编程', '做故事、动画和小游戏'], 90, 318, {
        size: 70,
        weight: 950,
        lineHeight: 92
      })}
      ${textBlock(['孩子先动手做出一个看得见的作品，', '再决定要不要继续深入学习。'], 94, 535, {
        size: 35,
        weight: 800,
        fill: '#646078',
        lineHeight: 54
      })}
      ${editorMock(780 + (1 - p) * 80, 252, 0.82, time, opacity)}
    </g>
  `;
}

function scenePrice (time, opacity) {
  const p = ease(sceneProgress(time, 10, 15));
  return `
    <g opacity="${opacity}">
      ${roundedRect(120, 270, 760, 470, 34, '#ffffff', '#ded8f1', 3)}
      ${textBlock(['首发主推'], 180, 350, {size: 38, weight: 900, fill: '#646078'})}
      ${textBlock(['¥199'], 180, 480, {size: 128, weight: 950})}
      ${textBlock(['/年'], 538, 480, {size: 54, weight: 900, fill: '#646078'})}
      ${textBlock(['低于很多课程的一两节课价格，', '先让孩子低成本试试编程创作。'], 184, 625, {
        size: 34,
        weight: 800,
        fill: '#646078',
        lineHeight: 52
      })}
      ${roundedRect(1040, 300 - p * 24, 640, 370, 32, '#fff8df', '#f2d27b', 3)}
      ${textBlock(['适合谁？'], 1104, 388 - p * 24, {size: 46, weight: 950, fill: '#8a5b00'})}
      ${textBlock(['6-10 岁孩子', '首发优先验证 6-8 岁家庭', '想先试试，不急着报课'], 1108, 470 - p * 24, {
        size: 36,
        weight: 850,
        fill: '#5d4e31',
        lineHeight: 58
      })}
    </g>
  `;
}

function sceneDownload (time, opacity) {
  const p = ease(sceneProgress(time, 15, 21));
  return `
    <g opacity="${opacity}">
      ${textBlock(['官网下载客户端，', '按电脑选择版本'], 90, 310, {
        size: 70,
        weight: 950,
        lineHeight: 92
      })}
      ${textBlock(['macOS Apple 芯片、macOS Intel、Windows 安装版、便携版。'], 94, 535, {
        size: 34,
        weight: 800,
        fill: '#646078'
      })}
      ${roundedRect(840, 258, 830, 505, 34, '#ffffff', '#ded8f1', 3)}
      ${pill('Windows 安装版', 900, 340, 330, '#6b4dff', '#ffffff', opacity)}
      ${pill('Windows 便携版', 1260, 340, 330, '#f8f6ff', '#6b4dff', opacity)}
      ${pill('macOS Apple 芯片', 900, 435, 330, '#f8f6ff', '#6b4dff', opacity)}
      ${pill('macOS Intel 芯片', 1260, 435, 330, '#f8f6ff', '#6b4dff', opacity)}
      ${roundedRect(940, 575 + (1 - p) * 22, 550, 130, 24, '#fff3cf', 'none', 0, opacity)}
      ${textBlock(['打开客户端后', '注册或登录新祥编程账号'], 990, 625 + (1 - p) * 22, {
        size: 32,
        weight: 900,
        fill: '#8a5b00',
        lineHeight: 48,
        opacity
      })}
    </g>
  `;
}

function scenePayment (time, opacity) {
  return `
    <g opacity="${opacity}">
      ${textBlock(['订阅解锁，', '在客户端内完成付款凭证'], 90, 285, {
        size: 66,
        weight: 950,
        lineHeight: 88
      })}
      ${textBlock(['首发阶段采用人工确认开通。', '付款后提交凭证，运营核对到账后刷新授权。'], 94, 515, {
        size: 34,
        weight: 800,
        fill: '#646078',
        lineHeight: 54
      })}
      ${roundedRect(910, 210, 700, 625, 34, '#ffffff', '#ded8f1', 3)}
      ${textBlock(['新祥编程订阅中心'], 1260, 285, {size: 38, weight: 950, anchor: 'middle', fill: '#6b4dff'})}
      ${textBlock(['应付金额'], 970, 365, {size: 30, weight: 800, fill: '#646078'})}
      ${textBlock(['¥199/年'], 970, 432, {size: 62, weight: 950})}
      ${pill('微信/支付宝', 1360, 350, 180, '#e8f5e9', '#1f6b31')}
      ${roundedRect(970, 492, 270, 270, 22, '#f6f9ff')}
      ${qrMock(1018, 532, 174)}
      ${roundedRect(1280, 500, 270, 68, 14, '#e8f5e9')}
      ${textBlock(['1. 创建订单'], 1310, 545, {size: 28, weight: 950, fill: '#1f6b31'})}
      ${roundedRect(1280, 586, 270, 68, 14, '#fff3cf')}
      ${textBlock(['2. 提交凭证'], 1310, 631, {size: 28, weight: 950, fill: '#8a5b00'})}
      ${roundedRect(1280, 672, 270, 68, 14, '#eaf4ff')}
      ${textBlock(['3. 刷新授权'], 1310, 717, {size: 28, weight: 950, fill: '#2f6fa3'})}
    </g>
  `;
}

function sceneFinal (time, opacity) {
  const p = ease(sceneProgress(time, 27, 30));
  return `
    <g opacity="${opacity}">
      ${editorMock(90, 245, 0.78, time, opacity)}
      ${roundedRect(1120, 300, 620, 430, 36, '#ffffff', '#ded8f1', 3)}
      ${textBlock(['确认后进入', '完整编程编辑器'], 1180, 405, {
        size: 60,
        weight: 950,
        lineHeight: 80
      })}
      ${textBlock(['如果你家有 6-10 岁孩子，', '想先低成本试试编程创作，', '可以从新祥编程开始。'], 1185, 568, {
        size: 34,
        weight: 800,
        fill: '#646078',
        lineHeight: 52
      })}
      ${roundedRect(1185, 760 - p * 14, 460, 84, 24, '#6b4dff')}
      ${textBlock(['私信获取下载方式'], 1415, 816 - p * 14, {
        size: 34,
        weight: 950,
        fill: '#ffffff',
        anchor: 'middle'
      })}
    </g>
  `;
}

function renderSvg (time) {
  const layers = [];
  layers.push(header());

  const scenes = [
    [0, 4, sceneIntro],
    [4, 10, sceneEditor],
    [10, 15, scenePrice],
    [15, 21, sceneDownload],
    [21, 27, scenePayment],
    [27, 30, sceneFinal]
  ];

  for (const [start, end, renderer] of scenes) {
    if (time >= start - 0.7 && time <= end + 0.7) {
      layers.push(renderer(time, fadeForScene(time, start, end)));
    }
  }

  layers.push(footer(time));

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#f3efff"/>
          <stop offset="52%" stop-color="#eef8ff"/>
          <stop offset="100%" stop-color="#fff7df"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#281e5a" flood-opacity="0.12"/>
        </filter>
      </defs>
      <style>
        text { font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Hiragino Sans GB", Arial, sans-serif; letter-spacing: 0; }
      </style>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      ${roundedRect(54, 50, 1812, 980, 44, 'rgba(255,255,255,0.58)', '#ded8f1', 2)}
      <g filter="url(#shadow)">
        ${layers.join('\n')}
      </g>
    </svg>
  `;
}

async function main () {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    throw new Error('缺少 ffmpeg。请设置 FFMPEG_PATH，或先安装 /tmp/zhimeng-video-tools/node_modules/ffmpeg-static/ffmpeg。');
  }

  fs.rmSync(framesDir, {recursive: true, force: true});
  fs.mkdirSync(framesDir, {recursive: true});
  fs.mkdirSync(outputDir, {recursive: true});

  console.log(`Rendering ${frameCount} frames...`);
  for (let i = 0; i < frameCount; i++) {
    const time = i / fps;
    const svg = renderSvg(time);
    const framePath = path.join(framesDir, `frame_${String(i).padStart(4, '0')}.jpg`);
    await sharp(Buffer.from(svg))
      .resize(width, height)
      .jpeg({quality: 92, chromaSubsampling: '4:4:4'})
      .toFile(framePath);

    if (i % fps === 0) {
      console.log(`  ${Math.floor(time)}s`);
    }
  }

  console.log('Encoding MP4...');
  const result = spawnSync(ffmpegPath, [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame_%04d.jpg'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-r', String(fps),
    outputVideo
  ], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`ffmpeg exited with ${result.status}`);
  }

  fs.rmSync(framesDir, {recursive: true, force: true});
  console.log(`Done: ${outputVideo}`);
}

const logoBase64 = fs.readFileSync(logoPath).toString('base64');

main().catch(error => {
  console.error(error);
  process.exit(1);
});

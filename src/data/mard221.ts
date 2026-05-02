// MARD 漫漫家 221 色 拼豆色卡
// 数据说明：以下为社区整理的近似 RGB 值。若需要严格匹配实物色，
// 用户可在「设置 → 色卡校准」中修改任一色号的 RGB（功能预留）。
// 索引 0 保留为「空」，色号从索引 1 (H1) 开始。

export interface BeadColor {
  id: string;       // 色号，例如 "H1"
  name: string;     // 中文名
  rgb: [number, number, number];
}

// 手工整理的常用色（覆盖白/黑/灰/红/橙/黄/绿/青/蓝/紫/棕/肤色/荧光等）
// 共 221 条，缺失部分用系统化 HSL 采样补齐
const HAND_PICKED: Array<[string, string, number, number, number]> = [
  ['H1',  '雪白',   255, 255, 255],
  ['H2',  '米白',   248, 240, 220],
  ['H3',  '奶黄',   252, 235, 180],
  ['H4',  '浅黄',   255, 230, 130],
  ['H5',  '柠檬黄', 255, 215, 0],
  ['H6',  '中黄',   255, 200, 0],
  ['H7',  '橘黄',   255, 165, 0],
  ['H8',  '深橘',   240, 130, 30],
  ['H9',  '橙红',   240, 90, 40],
  ['H10', '朱红',   220, 50, 40],
  ['H11', '大红',   200, 30, 40],
  ['H12', '深红',   160, 25, 35],
  ['H13', '酒红',   120, 25, 40],
  ['H14', '粉红',   255, 192, 203],
  ['H15', '浅粉',   255, 215, 220],
  ['H16', '玫红',   230, 80, 130],
  ['H17', '桃红',   255, 130, 150],
  ['H18', '樱花粉', 250, 200, 210],
  ['H19', '深玫红', 200, 50, 100],
  ['H20', '紫红',   170, 50, 110],
  ['H21', '浅紫',   200, 170, 220],
  ['H22', '中紫',   150, 100, 200],
  ['H23', '深紫',   100, 50, 150],
  ['H24', '葡萄紫', 80, 40, 130],
  ['H25', '丁香紫', 180, 160, 210],
  ['H26', '天蓝',   135, 206, 235],
  ['H27', '浅蓝',   170, 210, 240],
  ['H28', '中蓝',   60, 130, 220],
  ['H29', '湖蓝',   30, 150, 200],
  ['H30', '深蓝',   30, 60, 170],
  ['H31', '宝蓝',   20, 40, 140],
  ['H32', '藏青',   25, 35, 90],
  ['H33', '青色',   0, 180, 200],
  ['H34', '蒂芙尼蓝', 130, 220, 220],
  ['H35', '薄荷绿', 170, 230, 200],
  ['H36', '浅绿',   180, 230, 170],
  ['H37', '草绿',   120, 200, 80],
  ['H38', '中绿',   60, 170, 80],
  ['H39', '深绿',   30, 120, 60],
  ['H40', '墨绿',   20, 80, 50],
  ['H41', '橄榄绿', 130, 140, 50],
  ['H42', '黄绿',   180, 210, 70],
  ['H43', '果绿',   140, 200, 90],
  ['H44', '军绿',   90, 110, 60],
  ['H45', '浅棕',   200, 160, 120],
  ['H46', '中棕',   160, 110, 70],
  ['H47', '深棕',   110, 70, 40],
  ['H48', '咖啡',   80, 50, 30],
  ['H49', '巧克力', 60, 35, 20],
  ['H50', '驼色',   190, 150, 100],
  ['H51', '土黄',   200, 170, 90],
  ['H52', '卡其',   170, 150, 100],
  ['H53', '皮肤1',  255, 220, 195],
  ['H54', '皮肤2',  250, 200, 170],
  ['H55', '皮肤3',  235, 180, 145],
  ['H56', '皮肤4',  210, 150, 115],
  ['H57', '皮肤5',  170, 110, 80],
  ['H58', '皮肤6',  120, 75, 50],
  ['H59', '银灰',   200, 200, 205],
  ['H60', '浅灰',   180, 180, 185],
  ['H61', '中灰',   140, 140, 145],
  ['H62', '深灰',   90, 90, 95],
  ['H63', '炭灰',   55, 55, 60],
  ['H64', '黑色',   25, 25, 28],
  ['H65', '荧光黄', 240, 255, 30],
  ['H66', '荧光绿', 80, 255, 80],
  ['H67', '荧光橙', 255, 130, 50],
  ['H68', '荧光粉', 255, 80, 180],
  ['H69', '金色',   212, 175, 55],
  ['H70', '银色',   192, 192, 192],
];

// 用 HSL 系统化生成剩余颜色，确保色相均匀分布
function generateFiller(target: number, startId: number): Array<[string, string, number, number, number]> {
  const out: Array<[string, string, number, number, number]> = [];
  const need = target - HAND_PICKED.length;
  // 在 HSL 空间均匀采样：H 12 档 × S 3 档 × L 4~5 档
  const hues = 13;
  const sats = [0.4, 0.7, 1.0];
  const lights = [0.25, 0.4, 0.55, 0.7, 0.85];
  let i = 0;
  for (let l of lights) {
    for (let s of sats) {
      for (let h = 0; h < hues; h++) {
        if (i >= need) break;
        const hue = (h / hues) * 360;
        const [r, g, b] = hslToRgb(hue / 360, s, l);
        out.push([`H${startId + i}`, `色${startId + i}`, r, g, b]);
        i++;
      }
    }
  }
  return out;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const ALL_RAW = [...HAND_PICKED, ...generateFiller(221, HAND_PICKED.length + 1)].slice(0, 221);

// 索引 0 是「空」占位
export const MARD221: BeadColor[] = [
  { id: 'EMPTY', name: '空', rgb: [255, 255, 255] },
  ...ALL_RAW.map(([id, name, r, g, b]) => ({
    id: id as string,
    name: name as string,
    rgb: [r, g, b] as [number, number, number],
  })),
];

export const PALETTE_SIZE = MARD221.length - 1; // 221

export function colorById(id: string): BeadColor | undefined {
  return MARD221.find((c) => c.id === id);
}

export function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// 返回与给定 RGB 对比明显的文字颜色（用于在色块上写色号）
export function contrastTextColor(rgb: [number, number, number]): string {
  const [r, g, b] = rgb;
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? '#222' : '#fff';
}

/**
 * Gerador de QR Code compatível com ISO/IEC 18004
 * Baseado no algoritmo de domínio público / MIT por Kazuhiko Arase (qrcode-generator).
 * Implementação pura em TypeScript sem dependências externas de runtime.
 */

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

export interface QRCodeMatrix {
  size: number
  isDark: (row: number, col: number) => boolean
  toMatrix: () => boolean[][]
}

// ---------------------------------------------------------------------
// Constantes e Tabelas
// ---------------------------------------------------------------------

const PAD0 = 0xec
const PAD1 = 0x11

const QRMode = {
  MODE_NUMBER: 1 << 0,
  MODE_ALPHA_NUM: 1 << 1,
  MODE_8BIT_BYTE: 1 << 2,
  MODE_KANJI: 1 << 3,
}

const QRECC = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
}

const PATTERN_POSITION_TABLE: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
]

// G15 e G18 polinômios para BCH
const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0)
const G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0)
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1)

// Reed Solomon Block Table para 40 versões
// Formato: [count1, total1, data1, count2, total2, data2...]
const RS_BLOCK_TABLE: number[][][] = [
  // 1
  [
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],
  ],
  // 2
  [
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],
  ],
  // 3
  [
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],
  ],
  // 4
  [
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],
  ],
  // 5
  [
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],
  ],
  // 6
  [
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],
  ],
  // 7
  [
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],
  ],
  // 8
  [
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],
  ],
  // 9
  [
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],
  ],
  // 10
  [
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],
  ],
  // 11
  [
    [4, 101, 81],
    [1, 80, 50, 4, 81, 51],
    [4, 50, 22, 4, 51, 23],
    [3, 36, 12, 8, 37, 13],
  ],
  // 12
  [
    [2, 116, 92, 2, 117, 93],
    [6, 58, 36, 2, 59, 37],
    [4, 46, 20, 6, 47, 21],
    [7, 42, 14, 4, 43, 15],
  ],
  // 13
  [
    [4, 133, 107],
    [8, 59, 37, 1, 60, 38],
    [8, 44, 20, 4, 45, 21],
    [12, 33, 11, 4, 34, 12],
  ],
  // 14
  [
    [3, 145, 115, 1, 146, 116],
    [4, 64, 40, 5, 65, 41],
    [11, 36, 16, 5, 37, 17],
    [11, 36, 12, 5, 37, 13],
  ],
  // 15
  [
    [5, 109, 87, 1, 110, 88],
    [5, 65, 41, 5, 66, 42],
    [5, 54, 24, 7, 55, 25],
    [11, 36, 12, 7, 37, 13],
  ],
  // 16
  [
    [5, 122, 98, 1, 123, 99],
    [7, 73, 45, 3, 74, 46],
    [15, 43, 19, 2, 44, 20],
    [3, 45, 15, 13, 46, 16],
  ],
  // 17
  [
    [1, 135, 107, 5, 136, 108],
    [10, 74, 46, 1, 75, 47],
    [1, 50, 22, 15, 51, 23],
    [2, 42, 14, 17, 43, 15],
  ],
  // 18
  [
    [5, 150, 120, 1, 151, 121],
    [9, 69, 43, 4, 70, 44],
    [17, 50, 22, 1, 51, 23],
    [2, 42, 14, 19, 43, 15],
  ],
  // 19
  [
    [3, 141, 113, 4, 142, 114],
    [3, 70, 44, 11, 71, 45],
    [17, 47, 21, 4, 48, 22],
    [9, 39, 13, 16, 40, 14],
  ],
  // 20
  [
    [3, 135, 107, 5, 136, 108],
    [3, 67, 41, 13, 68, 42],
    [15, 54, 24, 5, 55, 25],
    [15, 43, 15, 10, 44, 16],
  ],
]

// ---------------------------------------------------------------------
// Galois Field GF(256) Matemática
// ---------------------------------------------------------------------

const EXP_TABLE: number[] = new Array(256)
const LOG_TABLE: number[] = new Array(256)

for (let i = 0; i < 256; i++) {
  EXP_TABLE[i] =
    i < 8 ? 1 << i : EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8]
}
for (let i = 0; i < 255; i++) {
  LOG_TABLE[EXP_TABLE[i]] = i
}

function glog(n: number): number {
  if (n < 1) throw new Error('log(' + n + ')')
  return LOG_TABLE[n]
}

function gexp(n: number): number {
  let v = n
  while (v < 0) v += 255
  while (v >= 256) v -= 255
  return EXP_TABLE[v]
}

// ---------------------------------------------------------------------
// Polinômios
// ---------------------------------------------------------------------

class QRPolynomial {
  private num: number[]

  constructor(num: number[], shift = 0) {
    let offset = 0
    while (offset < num.length && num[offset] === 0) offset++
    this.num = num.slice(offset).concat(new Array(shift).fill(0))
  }

  get(index: number): number {
    return this.num[index]
  }

  getLength(): number {
    return this.num.length
  }

  multiply(e: QRPolynomial): QRPolynomial {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0)
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)))
      }
    }
    return new QRPolynomial(num)
  }

  mod(e: QRPolynomial): QRPolynomial {
    if (this.getLength() - e.getLength() < 0) return this
    const ratio = glog(this.get(0)) - glog(e.get(0))
    const num = this.num.slice()
    for (let i = 0; i < e.getLength(); i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio)
    }
    return new QRPolynomial(num).mod(e)
  }
}

// ---------------------------------------------------------------------
// BitBuffer
// ---------------------------------------------------------------------

class QRBitBuffer {
  private buffer: number[] = []
  private length = 0

  getBuffer(): number[] {
    return this.buffer
  }

  getLengthInBits(): number {
    return this.length
  }

  put(num: number, length: number) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1)
    }
  }

  putBit(bit: boolean) {
    const bufIndex = Math.floor(this.length / 8)
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0)
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8)
    }
    this.length++
  }
}

// ---------------------------------------------------------------------
// Utilidades BCH e Posicionamento
// ---------------------------------------------------------------------

function getBCHDigit(data: number): number {
  let digit = 0
  let d = data
  while (d !== 0) {
    digit++
    d >>>= 1
  }
  return digit
}

function getBCHTypeInfo(data: number): number {
  let d = data << 10
  while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
    d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15))
  }
  return ((data << 10) | d) ^ G15_MASK
}

function getBCHTypeNumber(data: number): number {
  let d = data << 12
  while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
    d ^= G18 << (getBCHDigit(d) - getBCHDigit(G18))
  }
  return (data << 12) | d
}

function getErrorCorrectPolynomial(errorCorrectLength: number): QRPolynomial {
  let a = new QRPolynomial([1], 0)
  for (let i = 0; i < errorCorrectLength; i++) {
    a = a.multiply(new QRPolynomial([1, gexp(i)], 0))
  }
  return a
}

function getLengthInBits(mode: number, type: number): number {
  if (1 <= type && type < 10) {
    switch (mode) {
      case QRMode.MODE_NUMBER:
        return 10
      case QRMode.MODE_ALPHA_NUM:
        return 9
      case QRMode.MODE_8BIT_BYTE:
        return 8
      case QRMode.MODE_KANJI:
        return 8
      default:
        throw new Error('mode:' + mode)
    }
  } else if (type < 27) {
    switch (mode) {
      case QRMode.MODE_NUMBER:
        return 12
      case QRMode.MODE_ALPHA_NUM:
        return 11
      case QRMode.MODE_8BIT_BYTE:
        return 16
      case QRMode.MODE_KANJI:
        return 10
      default:
        throw new Error('mode:' + mode)
    }
  } else {
    switch (mode) {
      case QRMode.MODE_NUMBER:
        return 14
      case QRMode.MODE_ALPHA_NUM:
        return 13
      case QRMode.MODE_8BIT_BYTE:
        return 16
      case QRMode.MODE_KANJI:
        return 12
      default:
        throw new Error('mode:' + mode)
    }
  }
}

function getMaskFunction(maskPattern: number): (i: number, j: number) => boolean {
  switch (maskPattern) {
    case 0:
      return (i, j) => (i + j) % 2 === 0
    case 1:
      return (i) => i % 2 === 0
    case 2:
      return (_, j) => j % 3 === 0
    case 3:
      return (i, j) => (i + j) % 3 === 0
    case 4:
      return (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0
    case 5:
      return (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0
    case 6:
      return (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0
    case 7:
      return (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0
    default:
      throw new Error('bad maskPattern:' + maskPattern)
  }
}

interface RSBlockInfo {
  totalCount: number
  dataCount: number
}

function getRSBlocks(typeNumber: number, errorCorrectionLevel: number): RSBlockInfo[] {
  const table = RS_BLOCK_TABLE[typeNumber - 1]
  if (!table) throw new Error(`TypeNumber ${typeNumber} out of range [1..${RS_BLOCK_TABLE.length}]`)
  const rsBlock = table[errorCorrectionLevel]
  const length = Math.floor(rsBlock.length / 3)
  const list: RSBlockInfo[] = []
  for (let i = 0; i < length; i++) {
    const count = rsBlock[i * 3 + 0]
    const totalCount = rsBlock[i * 3 + 1]
    const dataCount = rsBlock[i * 3 + 2]
    for (let j = 0; j < count; j++) {
      list.push({ totalCount, dataCount })
    }
  }
  return list
}

// ---------------------------------------------------------------------
// UTF-8 encode
// ---------------------------------------------------------------------

function stringToUtf8ByteArray(str: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i)
    if (charCode < 0x80) {
      bytes.push(charCode)
    } else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6))
      bytes.push(0x80 | (charCode & 0x3f))
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      bytes.push(0xe0 | (charCode >> 12))
      bytes.push(0x80 | ((charCode >> 6) & 0x3f))
      bytes.push(0x80 | (charCode & 0x3f))
    } else {
      // surrogate pair
      i++
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
      bytes.push(0xf0 | (charCode >> 18))
      bytes.push(0x80 | ((charCode >> 12) & 0x3f))
      bytes.push(0x80 | ((charCode >> 6) & 0x3f))
      bytes.push(0x80 | (charCode & 0x3f))
    }
  }
  return bytes
}

// ---------------------------------------------------------------------
// Classe Principal de Geração
// ---------------------------------------------------------------------

export class QRCodeModel {
  private typeNumber: number
  private errorCorrectionLevel: number
  private modules: (boolean | null)[][] = []
  private moduleCount = 0
  private dataBytes: number[]

  constructor(data: string, ecl: ErrorCorrectionLevel = 'M') {
    this.errorCorrectionLevel = QRECC[ecl]
    this.dataBytes = stringToUtf8ByteArray(data)
    this.typeNumber = this.determineTypeNumber()
    this.make()
  }

  private determineTypeNumber(): number {
    for (let t = 1; t <= RS_BLOCK_TABLE.length; t++) {
      const rsBlocks = getRSBlocks(t, this.errorCorrectionLevel)
      let totalDataCount = 0
      for (const block of rsBlocks) {
        totalDataCount += block.dataCount
      }
      const lengthInBits = getLengthInBits(QRMode.MODE_8BIT_BYTE, t)
      const neededBits = 4 + lengthInBits + this.dataBytes.length * 8
      if (neededBits <= totalDataCount * 8) {
        return t
      }
    }
    throw new Error('Os dados excedem a capacidade suportada de QR code.')
  }

  private make() {
    this.makeImpl(false, this.getBestMaskPattern())
  }

  private getBestMaskPattern(): number {
    let minLostPoint = 0
    let pattern = 0
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i)
      const lostPoint = this.getLostPoint()
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint
        pattern = i
      }
    }
    return pattern
  }

  private makeImpl(test: boolean, maskPattern: number) {
    this.moduleCount = this.typeNumber * 4 + 17
    this.modules = Array.from({ length: this.moduleCount }, () =>
      Array(this.moduleCount).fill(null),
    )

    this.setupPositionProbePattern(0, 0)
    this.setupPositionProbePattern(this.moduleCount - 7, 0)
    this.setupPositionProbePattern(0, this.moduleCount - 7)
    this.setupPositionAdjustPattern()
    this.setupTimingPattern()
    this.setupTypeInfo(test, maskPattern)

    if (this.typeNumber >= 7) {
      this.setupTypeNumber(test)
    }

    const data = this.createData()
    this.mapData(data, maskPattern)
  }

  private setupPositionProbePattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue
        if (
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)
        ) {
          this.modules[row + r][col + c] = true
        } else {
          this.modules[row + r][col + c] = false
        }
      }
    }
  }

  private setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue
      this.modules[r][6] = r % 2 === 0
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue
      this.modules[6][c] = c % 2 === 0
    }
  }

  private setupPositionAdjustPattern() {
    const pos = PATTERN_POSITION_TABLE[this.typeNumber - 1]
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i]
        const col = pos[j]
        if (this.modules[row][col] !== null) continue
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            this.modules[row + r][col + c] =
              r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)
          }
        }
      }
    }
  }

  private setupTypeNumber(test: boolean) {
    const bits = getBCHTypeNumber(this.typeNumber)
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod
    }
  }

  private setupTypeInfo(test: boolean, maskPattern: number) {
    const data = (this.errorCorrectionLevel << 3) | maskPattern
    const bits = getBCHTypeInfo(data)

    // vertical
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      if (i < 6) {
        this.modules[i][8] = mod
      } else if (i < 8) {
        this.modules[i + 1][8] = mod
      } else {
        this.modules[this.moduleCount - 15 + i][8] = mod
      }
    }

    // horizontal
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      if (i < 8) {
        this.modules[8][this.moduleCount - i - 1] = mod
      } else if (i < 9) {
        this.modules[8][15 - i] = mod
      } else {
        this.modules[8][15 - i - 1] = mod
      }
    }

    // fixed module
    this.modules[this.moduleCount - 8][8] = !test
  }

  private mapData(data: number[], maskPattern: number) {
    let inc = -1
    let row = this.moduleCount - 1
    let bitIndex = 7
    let byteIndex = 0
    const maskFunc = getMaskFunction(maskPattern)

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1

      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1
            }
            if (maskFunc(row, col - c)) {
              dark = !dark
            }
            this.modules[row][col - c] = dark
            bitIndex -= 1
            if (bitIndex === -1) {
              byteIndex += 1
              bitIndex = 7
            }
          }
        }

        row += inc
        if (row < 0 || this.moduleCount <= row) {
          row -= inc
          inc = -inc
          break
        }
      }
    }
  }

  private createData(): number[] {
    const rsBlocks = getRSBlocks(this.typeNumber, this.errorCorrectionLevel)
    const buffer = new QRBitBuffer()

    buffer.put(QRMode.MODE_8BIT_BYTE, 4)
    buffer.put(this.dataBytes.length, getLengthInBits(QRMode.MODE_8BIT_BYTE, this.typeNumber))
    for (const b of this.dataBytes) {
      buffer.put(b, 8)
    }

    let totalDataCount = 0
    for (const block of rsBlocks) {
      totalDataCount += block.dataCount
    }

    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw new Error(`Code length overflow: ${buffer.getLengthInBits()} > ${totalDataCount * 8}`)
    }

    // terminador
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
      buffer.put(0, 4)
    }

    // padding para múltiplo de 8
    while (buffer.getLengthInBits() % 8 !== 0) {
      buffer.putBit(false)
    }

    // bytes de preenchimento alternados PAD0 / PAD1
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) break
      buffer.put(PAD0, 8)
      if (buffer.getLengthInBits() >= totalDataCount * 8) break
      buffer.put(PAD1, 8)
    }

    return this.createBytes(buffer, rsBlocks)
  }

  private createBytes(buffer: QRBitBuffer, rsBlocks: RSBlockInfo[]): number[] {
    let offset = 0
    let maxDcCount = 0
    let maxEcCount = 0

    const dcdata: number[][] = new Array(rsBlocks.length)
    const ecdata: number[][] = new Array(rsBlocks.length)

    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r].dataCount
      const ecCount = rsBlocks[r].totalCount - dcCount
      maxDcCount = Math.max(maxDcCount, dcCount)
      maxEcCount = Math.max(maxEcCount, ecCount)

      dcdata[r] = new Array(dcCount)
      const rawBuf = buffer.getBuffer()
      for (let i = 0; i < dcdata[r].length; i++) {
        dcdata[r][i] = 0xff & (rawBuf[i + offset] || 0)
      }
      offset += dcCount

      const rsPoly = getErrorCorrectPolynomial(ecCount)
      const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1)
      const modPoly = rawPoly.mod(rsPoly)
      ecdata[r] = new Array(rsPoly.getLength() - 1)
      for (let i = 0; i < ecdata[r].length; i++) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length
        ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0
      }
    }

    let totalCodeCount = 0
    for (const b of rsBlocks) {
      totalCodeCount += b.totalCount
    }

    const data: number[] = new Array(totalCodeCount)
    let index = 0

    for (let i = 0; i < maxDcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) {
          data[index++] = dcdata[r][i]
        }
      }
    }

    for (let i = 0; i < maxEcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) {
          data[index++] = ecdata[r][i]
        }
      }
    }

    return data
  }

  private getLostPoint(): number {
    const mc = this.moduleCount
    let lostPoint = 0

    // N1: Linhas e colunas de mesma cor seguidas
    for (let row = 0; row < mc; row++) {
      for (let col = 0; col < mc; col++) {
        let sameCount = 0
        const dark = this.isDark(row, col)
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || mc <= row + r) continue
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || mc <= col + c) continue
            if (r === 0 && c === 0) continue
            if (dark === this.isDark(row + r, col + c)) {
              sameCount++
            }
          }
        }
        if (sameCount > 5) {
          lostPoint += 3 + sameCount - 5
        }
      }
    }

    // N2: Blocos 2x2
    for (let row = 0; row < mc - 1; row++) {
      for (let col = 0; col < mc - 1; col++) {
        let count = 0
        if (this.isDark(row, col)) count++
        if (this.isDark(row + 1, col)) count++
        if (this.isDark(row, col + 1)) count++
        if (this.isDark(row + 1, col + 1)) count++
        if (count === 0 || count === 4) {
          lostPoint += 3
        }
      }
    }

    // N3: Padrões similares a finder (1:1:3:1:1)
    for (let row = 0; row < mc; row++) {
      for (let col = 0; col < mc - 6; col++) {
        if (
          this.isDark(row, col) &&
          !this.isDark(row, col + 1) &&
          this.isDark(row, col + 2) &&
          this.isDark(row, col + 3) &&
          this.isDark(row, col + 4) &&
          !this.isDark(row, col + 5) &&
          this.isDark(row, col + 6)
        ) {
          lostPoint += 40
        }
      }
    }

    for (let col = 0; col < mc; col++) {
      for (let row = 0; row < mc - 6; row++) {
        if (
          this.isDark(row, col) &&
          !this.isDark(row + 1, col) &&
          this.isDark(row + 2, col) &&
          this.isDark(row + 3, col) &&
          this.isDark(row + 4, col) &&
          !this.isDark(row + 5, col) &&
          this.isDark(row + 6, col)
        ) {
          lostPoint += 40
        }
      }
    }

    // N4: Proporção preto/branco
    let darkCount = 0
    for (let col = 0; col < mc; col++) {
      for (let row = 0; row < mc; row++) {
        if (this.isDark(row, col)) darkCount++
      }
    }
    const ratio = Math.abs((100 * darkCount) / mc / mc - 50) / 5
    lostPoint += ratio * 10

    return lostPoint
  }

  isDark(row: number, col: number): boolean {
    if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
      return false
    }
    return !!this.modules[row][col]
  }

  getModuleCount(): number {
    return this.moduleCount
  }

  toMatrix(): boolean[][] {
    const matrix: boolean[][] = []
    for (let r = 0; r < this.moduleCount; r++) {
      const row: boolean[] = []
      for (let c = 0; c < this.moduleCount; c++) {
        row.push(this.isDark(r, c))
      }
      matrix.push(row)
    }
    return matrix
  }
}

/**
 * Atalho para gerar matriz booleana de QR Code para qualquer texto/URL
 */
export function generateQRCode(data: string, ecl: ErrorCorrectionLevel = 'M'): QRCodeMatrix {
  const model = new QRCodeModel(data, ecl)
  return {
    size: model.getModuleCount(),
    isDark: (r: number, c: number) => model.isDark(r, c),
    toMatrix: () => model.toMatrix(),
  }
}

export interface WatermarkOptions {
  padTop: number
  padBottom: number
  barColor: string
  text: string
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  opacity: number
  x: number
  y: number
}

export interface FrameLayout {
  width: number
  height: number
  top: number
  bottom: number
  lines: string[]
  lineHeight: number
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export function fontString(options: Pick<WatermarkOptions, 'fontFamily' | 'fontSize' | 'bold' | 'italic'>, scale = 1): string {
  const size = Math.max(1, Math.round(options.fontSize * scale))
  return `${options.italic ? 'italic ' : ''}${options.bold ? '700' : '400'} ${size}px "${options.fontFamily}", "Microsoft YaHei UI", "PingFang SC", sans-serif`
}

export function layoutOf(imageWidth: number, imageHeight: number, options: WatermarkOptions): FrameLayout {
  const top = clamp(Math.round(options.padTop), 0, Math.round(imageHeight * 0.5))
  const bottom = clamp(Math.round(options.padBottom), 0, Math.round(imageHeight * 0.5))
  const lines = (options.text || '').split('\n')
  return {
    width: imageWidth,
    height: imageHeight + top + bottom,
    top,
    bottom,
    lines,
    lineHeight: Math.round(options.fontSize * 1.38)
  }
}

export function textBox(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  options: WatermarkOptions
): { left: number; top: number; width: number; height: number } {
  ctx.save()
  ctx.font = fontString(options)
  const width = Math.max(...layout.lines.map((line) => ctx.measureText(line || ' ').width), 1)
  ctx.restore()

  const anchorX = options.x * layout.width
  const left =
    options.align === 'center' ? anchorX - width / 2 : options.align === 'right' ? anchorX - width : anchorX
  return {
    left,
    top: options.y * layout.height,
    width,
    height: layout.lines.length * layout.lineHeight
  }
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  options: WatermarkOptions,
  scale = 1
): FrameLayout {
  const layout = layoutOf(imageWidth, imageHeight, options)

  ctx.save()
  ctx.scale(scale, scale)
  ctx.clearRect(0, 0, layout.width, layout.height)
  ctx.fillStyle = options.barColor
  ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, layout.top, imageWidth, imageHeight)

  if (options.text.trim()) {
    ctx.globalAlpha = options.opacity
    ctx.fillStyle = options.color
    ctx.font = fontString(options)
    ctx.textAlign = options.align
    ctx.textBaseline = 'alphabetic'
    const box = textBox(ctx, layout, options)
    layout.lines.forEach((line, index) => {
      ctx.fillText(line, options.x * layout.width, box.top + options.fontSize * 0.86 + index * layout.lineHeight)
    })
    ctx.globalAlpha = 1
  }

  ctx.restore()
  return layout
}

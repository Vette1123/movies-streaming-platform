declare module '@splidejs/react-splide' {
  import * as React from 'react'
  import type { Splide as SplideCore, Options } from '@splidejs/splide'

  export interface SplideProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrag' | 'onDragEnd'> {
    options?: Options
    extensions?: Record<string, unknown>
    transition?: unknown
    hasTrack?: boolean
    tag?: keyof React.JSX.IntrinsicElements
    Progress?: React.ReactNode
    'aria-label'?: string
    'aria-labelledby'?: string
    id?: string
    className?: string
    onMounted?: (splide: SplideCore) => void
    onReady?: (splide: SplideCore) => void
    onMove?: (...args: unknown[]) => void
    onMoved?: (...args: unknown[]) => void
    onClick?: (...args: unknown[]) => void
    onActive?: (...args: unknown[]) => void
    onInactive?: (...args: unknown[]) => void
    onVisible?: (...args: unknown[]) => void
    onHidden?: (...args: unknown[]) => void
    onRefresh?: (...args: unknown[]) => void
    onUpdated?: (...args: unknown[]) => void
    onResize?: (...args: unknown[]) => void
    onResized?: (...args: unknown[]) => void
    onDrag?: (...args: unknown[]) => void
    onDragging?: (...args: unknown[]) => void
    onDragged?: (...args: unknown[]) => void
    onScroll?: (...args: unknown[]) => void
    onScrolled?: (...args: unknown[]) => void
    onDestroy?: (...args: unknown[]) => void
    onArrowsMounted?: (...args: unknown[]) => void
    onArrowsUpdated?: (...args: unknown[]) => void
    onPaginationMounted?: (...args: unknown[]) => void
    onPaginationUpdated?: (...args: unknown[]) => void
    onNavigationMounted?: (...args: unknown[]) => void
    onAutoplayPlay?: (...args: unknown[]) => void
    onAutoplayPause?: (...args: unknown[]) => void
    onAutoplayPlaying?: (...args: unknown[]) => void
    onLazyLoadLoaded?: (...args: unknown[]) => void
  }

  export class Splide extends React.Component<SplideProps> {
    readonly splideRef: React.RefObject<HTMLDivElement>
    splide: SplideCore | undefined
    sync(splide: SplideCore): void
    go(control: number | string): void
  }

  export const SplideSlide: React.FC<React.LiHTMLAttributes<HTMLLIElement>>
  export const SplideTrack: React.FC<React.HTMLAttributes<HTMLDivElement>>

  export { Options }
}

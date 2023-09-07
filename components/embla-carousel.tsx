// 'use client'

// // components/Carousel.tsx
// // import the hook and options type
// import { PropsWithChildren } from 'react'
// import Autoplay from 'embla-carousel-autoplay'
// import useEmblaCarousel, { EmblaOptionsType } from 'embla-carousel-react'
// import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'

// // Define the props
// type Props = PropsWithChildren & EmblaOptionsType

// const Carousel = ({ children, ...options }: Props) => {
//   // 1. useEmblaCarousel returns a emblaRef and we must attach the ref to a container.
//   // EmblaCarousel will use that ref as basis for swipe and other functionality.
//   const [emblaRef] = useEmblaCarousel(options, [
//     Autoplay(),
//     WheelGesturesPlugin(),
//   ])

//   return (
//     // Attach ref to a div
//     // 2. The wrapper div must have overflow:hidden
//     <div
//       className="embla overflow-hidden motion-reduce:transition-none"
//       ref={emblaRef}
//     >
//       {/* 3. The inner div must have a display:flex property */}
//       {/* 4. We pass the children as-is so that the outside component can style it accordingly */}
//       <div className="embla__container flex flex-1 cursor-grabbing">
//         {children}
//       </div>
//     </div>
//   )
// }
// export default Carousel

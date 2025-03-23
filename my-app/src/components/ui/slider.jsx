import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "../../lib/utils"

const Slider = React.forwardRef(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className="relative h-6 w-full grow overflow-hidden rounded-full bg-gray-300 shadow-inner"
    >
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-[#0055bf] to-[#d01012]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-10 w-10 rounded-full border-4 border-[#d01012] bg-white shadow-lg ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 transition-transform duration-200 z-10"
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider } 
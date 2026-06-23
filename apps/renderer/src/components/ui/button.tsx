import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-[#7c3aed] bg-[#7c3aed] text-white shadow-[0_8px_18px_rgba(124,58,237,0.18)] hover:border-[#8b5cf6] hover:bg-[#8b5cf6] hover:text-white",
        outline:
          "border-[#a78bfa]/55 bg-[#241b35] text-white hover:border-[#c4b5fd] hover:bg-[#2f2450] hover:text-white aria-expanded:border-[#c4b5fd] aria-expanded:bg-[#2f2450] aria-expanded:text-white dark:border-[#a78bfa]/45 dark:bg-[#241b35] dark:text-white dark:hover:bg-[#2f2450]",
        secondary:
          "border-[#a78bfa]/50 bg-[#2b2142] text-white hover:border-[#c4b5fd] hover:bg-[#38275f] hover:text-white aria-expanded:border-[#c4b5fd] aria-expanded:bg-[#38275f] aria-expanded:text-white",
        ghost:
          "text-[#4c1d95] hover:bg-[#ede9fe] hover:text-[#2e1065] aria-expanded:bg-[#ede9fe] aria-expanded:text-[#2e1065] dark:text-[#f4f0ff] dark:hover:bg-[#2f2450] dark:hover:text-white",
        destructive:
          "border-[#be123c] bg-[#be123c] text-white hover:border-[#e11d48] hover:bg-[#e11d48] focus-visible:border-[#e11d48] focus-visible:ring-[#fb7185]/35 dark:border-[#fb7185] dark:bg-[#9f1239] dark:hover:bg-[#be123c]",
        link: "text-[#5b21b6] underline-offset-4 hover:text-[#4c1d95] hover:underline dark:text-[#ddd6fe] dark:hover:text-white",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  disabled,
  loading = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const busy = loading || props["aria-busy"] === true || props["aria-busy"] === "true"

  return (
    <Comp
      {...props}
      aria-busy={busy ? true : undefined}
      data-feedback="button"
      data-loading={busy ? true : undefined}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
    />
  )
}

export { Button, buttonVariants }

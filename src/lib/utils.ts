import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Metadata } from 'next'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function constructMetadata({
  title = "Lexara",
  description = "Software for making PDF OCR seamless",
  image = "",
  icons = "/icon.svg",
  noIndex = false
}: {
  title?: string
  description?: string
  image?: string
  icons?: string
  noIndex?: boolean
} = {}): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: image
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      creator: "@vijay"
    },
    icons,
    metadataBase: new URL('https://google.com/'),
    // ❌ Removed themeColor
    ...(noIndex && {
      robots: {
        index: false,
        follow: false
      }
    })
  }
}

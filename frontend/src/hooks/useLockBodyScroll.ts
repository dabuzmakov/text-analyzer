import { useEffect } from 'react'

export function useLockBodyScroll() {
  useEffect(() => {
    const scrollY = window.scrollY
    const html = document.documentElement
    const body = document.body
    const scrollbarWidth = window.innerWidth - html.clientWidth

    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousPosition = body.style.position
    const previousTop = body.style.top
    const previousLeft = body.style.left
    const previousRight = body.style.right
    const previousWidth = body.style.width
    const previousPaddingRight = body.style.paddingRight

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.position = previousPosition
      body.style.top = previousTop
      body.style.left = previousLeft
      body.style.right = previousRight
      body.style.width = previousWidth
      body.style.paddingRight = previousPaddingRight
      window.scrollTo(0, scrollY)
    }
  }, [])
}

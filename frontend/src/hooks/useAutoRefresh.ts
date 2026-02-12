import { useEffect, useRef } from 'react'

export function useAutoRefresh(callback: () => void, intervalSec: number | null) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!intervalSec || intervalSec <= 0) return
    const id = setInterval(() => savedCallback.current(), intervalSec * 1000)
    return () => clearInterval(id)
  }, [intervalSec])
}

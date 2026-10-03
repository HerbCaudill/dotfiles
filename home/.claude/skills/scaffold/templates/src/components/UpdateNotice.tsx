import { useEffect, useRef, useState } from "react"
import { registerSW } from "virtual:pwa-register"
import { IconRefresh } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

/** Offer an explicit update without reloading unsaved work or other open windows. */
export function UpdateNotice(
  /** No external configuration. */
  _props: Props,
) {
  const [waiting, setWaiting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string>()
  const update = useRef<ReturnType<typeof registerSW>>(undefined)
  const readyToReload = useRef(false)
  const requested = useRef(false)

  /** Honor the same draft and local-save guards used when leaving the app. */
  const canReload = () => {
    const leaving = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(leaving)
    if (!leaving.defaultPrevented) return true
    setError("Finish saving your changes, then try again.")
    return false
  }

  useEffect(() => {
    // Strict Mode repeats effects; registration and its callbacks must stay singular.
    if (update.current) return
    update.current = registerSW({
      onNeedRefresh: () => setWaiting(true),
      onNeedReload: () => {
        readyToReload.current = true
        if (requested.current && canReload()) {
          location.reload()
          return
        }
        requested.current = false
        setUpdating(false)
        setWaiting(true)
      },
    })
  }, [])

  /** Activate the downloaded worker, then reload only this consenting window. */
  const installUpdate = async () => {
    if (requested.current) return
    setError(undefined)
    if (!canReload()) return
    if (readyToReload.current) {
      location.reload()
      return
    }
    requested.current = true
    setUpdating(true)
    try {
      await update.current?.(true)
    } catch {
      requested.current = false
      setUpdating(false)
      setError("Could not install the update. Try again.")
    }
  }

  return waiting ? (
    <aside
      aria-label="App update"
      className="bg-background fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 max-w-[calc(100vw-2rem)] rounded-lg border p-3 text-sm shadow-lg"
    >
      <div className="flex items-center gap-3">
        <p role="status">An update is ready.</p>
        <Button size="sm" disabled={updating} onClick={() => void installUpdate()}>
          <IconRefresh aria-hidden="true" />
          {updating ? "Updating…" : "Update now"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive mt-2 max-w-72">
          {error}
        </p>
      )}
    </aside>
  ) : null
}

type Props = Record<string, never>

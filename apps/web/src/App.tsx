// App shell, ported from Huabu-main/apps/web/src/App.tsx (MIT, Microsoft).
//
// Same structure: a data router built exactly once, a never-unmounting
// `RootLayout`, a guard layout that sends users to a "not ready" page,
// and the heavy canvas route behind `React.lazy` so its chunk stays out
// of the entry graph.
//
// Two adaptations for SaaS. Huabu's gate was "is a local workspace
// selected?" and its escape hatch was `/setup`; CoResearch's gate is "is
// the user signed in?" and the escape hatch is `/login`. And Huabu's
// `useBlocker` drain (pending canvas saves must land before the captured
// canvasId goes stale) is NOT ported — there is nothing to drain until
// the canvas can be edited, which is ticket 05. Its removal is deliberate,
// not an oversight: re-add it with the first write path.

import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom'

import { PrototypeApp } from './components/Home/PrototypeApp'
import { AppLoadingScreen } from './pages/AppLoadingScreen'
import LoginPage from './pages/LoginPage'
import ProjectListPage from './pages/ProjectListPage'
import { useSessionStore } from './store/sessionStore'

/**
 * Loaded on demand so the canvas renderer's vendor chunks stay out of the
 * entry graph — everything Vite reaches statically from `main.tsx` must be
 * parsed before the first paint.
 */
const CanvasPage = lazy(() => import('./pages/CanvasPage'))

/**
 * Carries the "still resolving the initial session" flag from the App
 * root into route elements without forcing the router to rebuild on
 * state change. The router config is built once and frozen (so the URL
 * and history survive), and the components it renders pull this value
 * via context instead of via element props.
 */
const InitialisingContext = createContext(true)

/** Top-level shell. Mounts once for the app's lifetime. */
function RootLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}

/**
 * Layout-route guard: renders the matched child route, or bounces to
 * /login when there is no session. `initialising` is carried in React
 * state rather than the route config so the router itself is built once
 * and never loses history/URL state.
 */
function AuthGuardLayout() {
  const initialising = useContext(InitialisingContext)
  const isReady = useSessionStore((s) => s.isReady)

  if (initialising) return <AppLoadingScreen />
  if (!isReady) return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * Login route element: spinner while bootstrapping, then the real page.
 * Mirrors Huabu's `SetupRoute` so the route config itself stays a plain
 * element and can be frozen.
 */
function LoginRoute() {
  const initialising = useContext(InitialisingContext)
  return initialising ? <AppLoadingScreen /> : <LoginPage />
}

export default function App() {
  const init = useSessionStore((s) => s.init)
  const [initialising, setInitialising] = useState(true)

  useEffect(() => {
    void init().finally(() => setInitialising(false))
  }, [init])

  // Built once: rebuilding would remount RouterProvider and lose the URL.
  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          element: <RootLayout />,
          children: [
            // Outside the guard: it is where the guard sends you.
            { path: '/login', element: <LoginRoute /> },
            {
              element: <AuthGuardLayout />,
              children: [
                { path: '/', element: <Navigate to="/projects" replace /> },
                { path: '/projects', element: <ProjectListPage /> },
                {
                  path: '/canvas/:canvasId',
                  element: (
                    <Suspense fallback={<AppLoadingScreen message="加载画布…" />}>
                      <CanvasPage />
                    </Suspense>
                  ),
                },
                { path: '/prototype', element: <PrototypeApp /> },
                { path: '*', element: <Navigate to="/" replace /> },
              ],
            },
          ],
        },
      ]),
    [],
  )

  return (
    <InitialisingContext.Provider value={initialising}>
      <RouterProvider router={router} />
    </InitialisingContext.Provider>
  )
}

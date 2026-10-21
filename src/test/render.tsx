import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { DataProvider } from '../store'

export function renderApp(path = '/', db = `ui-${Math.random()}`) {
  const u = userEvent.setup()
  const r = render(<MemoryRouter initialEntries={[path]}><DataProvider dbName={db}><App /></DataProvider></MemoryRouter>)
  return { u, db, ...r }
}

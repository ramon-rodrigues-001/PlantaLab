
import './App.css'
import React, { useState } from 'react'
import Plan2D from './components/Plan2D'

export default function App() {
  const [plan, setPlan] = useState({ walls: [] })
  return (
    <div className="app">
      <header className="app-header">PlantaLab — 2D (MVP)</header>
      <main className="app-main">
        <Plan2D plan={plan} setPlan={setPlan} />
      </main>
      <footer className="app-footer">Para orçamentos reais, consulte um engenheiro.</footer>
    </div>
  )
}



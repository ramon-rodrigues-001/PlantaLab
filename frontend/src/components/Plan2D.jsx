import React, { useRef, useState, useEffect } from 'react'
import { Stage, Layer, Line, Text, Group, Circle, Rect } from 'react-konva'
import jsPDF from 'jspdf'

function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export default function Plan2D({ plan, setPlan }) {
  const stageRef = useRef(null)
  const [walls, setWalls] = useState(plan?.walls || [])
  const [drawing, setDrawing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [currentStart, setCurrentStart] = useState({ x: 0, y: 0 })
  const [currentEnd, setCurrentEnd] = useState({ x: 0, y: 0 })
  const [draggingWall, setDraggingWall] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [selectedWall, setSelectedWall] = useState(null)

  const [pxPerMeter, setPxPerMeter] = useState(40)
  const [wallHeight, setWallHeight] = useState(2.8)
  const [brickPerM2, setBrickPerM2] = useState(50)
  const [lossPercent, setLossPercent] = useState(5)
  const gridSize = 20

  useEffect(() => { if (setPlan) setPlan({ walls }) }, [walls])

  const snap = value => Math.round(value / gridSize) * gridSize

  const openingTypes = {
    door: [
      { name: 'Porta simples', widthMeters: 1 },
      { name: 'Porta dupla', widthMeters: 1.5 }
    ],
    window: [
      { name: 'Janela pequena', widthMeters: 1 },
      { name: 'Janela grande', widthMeters: 1.5 }
    ]
  }

  function addOpening(wallIndex, type = 'door', widthMeters = 1) {
    setWalls(prev => prev.map((w, i) => {
      if (i !== wallIndex) return w
      const newOpenings = w.openings ? [...w.openings] : []
      newOpenings.push({ type, pos: 0.2, widthMeters })
      return { ...w, openings: newOpenings }
    }))
  }

  function handleOpeningDrag(e, wallIndex, openingIndex) {
    const wall = walls[wallIndex]
    const pos = e.target.position()
    const dx = wall.x2 - wall.x1
    const dy = wall.y2 - wall.y1
    const wallLength = Math.sqrt(dx*dx + dy*dy)
    let relPos = ((pos.x - wall.x1) * dx + (pos.y - wall.y1) * dy) / (wallLength * wallLength)
    relPos = Math.max(0, Math.min(1, relPos))
    setWalls(prev => prev.map((w, wi) => {
      if (wi !== wallIndex) return w
      const newOpenings = [...(w.openings || [])]
      newOpenings[openingIndex].pos = relPos
      return { ...w, openings: newOpenings }
    }))
  }

  function handleOpeningResize(e, wallIndex, openingIndex, handle) {
    const wall = walls[wallIndex]
    const pos = e.target.position()
    const dx = wall.x2 - wall.x1
    const dy = wall.y2 - wall.y1
    const wallLength = Math.sqrt(dx*dx + dy*dy)
    setWalls(prev => prev.map((w, wi) => {
      if (wi !== wallIndex) return w
      const newOpenings = [...(w.openings || [])]
      const o = newOpenings[openingIndex]
      const vx = dx / wallLength
      const vy = dy / wallLength

      // Mantemos a largura em metros, apenas ajustando a posição relativa
      if (handle === 'start') {
        const newPos = ((pos.x - wall.x1) * vx + (pos.y - wall.y1) * vy) / wallLength
        o.pos = Math.max(0, Math.min(newPos, 1))
      } else {
        const newPosEnd = ((pos.x - wall.x1) * vx + (pos.y - wall.y1) * vy) / wallLength
        o.pos = Math.max(0, Math.min(newPosEnd - o.widthMeters / (wallLength / pxPerMeter), 1))
      }

      newOpenings[openingIndex] = o
      return { ...w, openings: newOpenings }
    }))
  }

  function handleMouseDown(e) {
    const pos = e.target.getStage().getPointerPosition()
    if (!pos) return
    setDrawing(true)
    setCurrentStart({ x: snap(pos.x), y: snap(pos.y) })
    setCurrentEnd({ x: snap(pos.x), y: snap(pos.y) })
  }

  function handleMouseMove(e) {
    const pos = e.target.getStage().getPointerPosition()
    if (!pos) return
    const x = snap(pos.x)
    const y = snap(pos.y)

    if (draggingWall !== null) {
      const dx = x - dragOffset.x
      const dy = y - dragOffset.y
      setWalls(prev => prev.map((w, i) => {
        if (i !== draggingWall) return w
        return { x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy, openings: w.openings }
      }))
      setDragOffset({ x, y })
      return
    }

    if (!drawing) return
    setCurrentEnd({ x, y })
  }

  function handleMouseUp() {
    if (drawing && distance(currentStart, currentEnd) > 6) {
      setWalls(prev => [...prev, { x1: currentStart.x, y1: currentStart.y, x2: currentEnd.x, y2: currentEnd.y, openings: [] }])
    }
    setDrawing(false)
    setCurrentStart({ x: 0, y: 0 })
    setCurrentEnd({ x: 0, y: 0 })
    setDraggingWall(null)
  }

  function handleVertexDrag(e, wallIndex, vertex) {
    const pos = { x: snap(e.target.x()), y: snap(e.target.y()) }
    setWalls(prev => prev.map((w, i) => {
      if (i !== wallIndex) return w
      if (vertex === 'start') return { ...w, x1: pos.x, y1: pos.y }
      else return { ...w, x2: pos.x, y2: pos.y }
    }))
  }

  function handleWallDragStart(e, index) {
    const pos = e.target.getStage().getPointerPosition()
    if (!pos) return
    setDraggingWall(index)
    setDragOffset({ x: snap(pos.x), y: snap(pos.y) })
  }

  function clearAll() { setWalls([]) }
  function undo() { setWalls(prev => prev.slice(0, -1)) }
  function deleteWall(index) {
    if (window.confirm('Deseja realmente excluir esta parede?')) {
      setWalls(prev => prev.filter((_, i) => i !== index))
    }
  }

  const totalLengthPx = walls.reduce((acc, w) => acc + distance({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }), 0)
  const totalLengthM = totalLengthPx / pxPerMeter
  const wallArea = totalLengthM * wallHeight - walls.reduce((acc, w) => {
    const openingsArea = w.openings?.reduce((a, o) => a + o.widthMeters * wallHeight, 0) || 0
    return acc + openingsArea
  }, 0)
  const bricksRaw = wallArea * brickPerM2
  const bricksWithLoss = Math.ceil(bricksRaw * (1 + lossPercent / 100))
  const mortarVolume = wallArea * 0.03
  const sandVolume = mortarVolume * 0.5
  const cementKg = mortarVolume * 180
  const steelKg = wallArea * 2
  const plasterKg = wallArea * 5
  const paintL = wallArea * 0.2

  function formatNumber(v) { return Number(v).toFixed(2) }

  function midPoint(w) { return { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 } }

  function loadPreset(preset = 'room') {
    if (preset === 'room') {
      setWalls([
        { x1: 100, y1: 100, x2: 500, y2: 100, openings: [{ type:'door', pos:0.1, widthMeters:1 }] },
        { x1: 500, y1: 100, x2: 500, y2: 300, openings: [{ type:'window', pos:0.3, widthMeters:1 }] },
        { x1: 500, y1: 300, x2: 100, y2: 300, openings: [] },
        { x1: 100, y1: 300, x2: 100, y2: 100, openings: [] }
      ])
    } else if (preset === 'line') {
      setWalls([{ x1: 120, y1: 200, x2: 620, y2: 200, openings: [] }])
    } else {
      setWalls([])
    }
  }

  // Função PDF
  function exportPDF() {
  if (!stageRef.current) return
  const uri = stageRef.current.toDataURL({ pixelRatio: 2 })
  const img = new Image()
  img.src = uri
  img.onload = () => {
    const pdf = new jsPDF('portrait', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    // --- Página 1: Planta ocupando toda a folha ---
    const ratio = Math.min(pageWidth / img.width, pageHeight / img.height)
    const imgWidth = img.width * ratio
    const imgHeight = img.height * ratio
    const xOffset = (pageWidth - imgWidth)/2
    const yOffset = (pageHeight - imgHeight)/2
    pdf.addImage(img, 'PNG', xOffset, yOffset, imgWidth, imgHeight)

    // --- Página 2: Resumo de materiais ---
    pdf.addPage()
    pdf.setFontSize(20)
    pdf.setTextColor(30, 30, 30)
    pdf.text('Resumo de Materiais', 10, 20)

    const totalWallArea = walls.reduce((acc, w) => {
      const lengthM = distance({x:w.x1,y:w.y1},{x:w.x2,y:w.y2})/pxPerMeter
      const areaM2 = lengthM*wallHeight - (w.openings?.reduce((a,o)=>a + o.widthMeters*wallHeight,0)||0)
      return acc + areaM2
    }, 0)
    const totalBricks = Math.ceil(totalWallArea * brickPerM2 * (1 + lossPercent/100))
    const totalMortar = totalWallArea * 0.03
    const totalSand = totalMortar * 0.5
    const totalCement = totalMortar * 180
    const totalSteel = totalWallArea * 2
    const totalPlaster = totalWallArea * 5
    const totalPaint = totalWallArea * 0.2

    const materials = [
      { name: 'Blocos', value: totalBricks, color: '#fbbf24' },
      { name: 'Argamassa (m³)', value: totalMortar.toFixed(2), color: '#a3e635' },
      { name: 'Areia (m³)', value: totalSand.toFixed(2), color: '#60a5fa' },
      { name: 'Cimento (kg)', value: totalCement.toFixed(0), color: '#f87171' },
      { name: 'Ferragem (kg)', value: totalSteel.toFixed(2), color: '#34d399' },
      { name: 'Reboco (kg)', value: totalPlaster.toFixed(2), color: '#f472b6' },
      { name: 'Tinta (L)', value: totalPaint.toFixed(2), color: '#3b82f6' }
    ]

    let y = 30
    const blockHeight = 20
    materials.forEach(m => {
      pdf.setFillColor(m.color)
      pdf.rect(10, y, pageWidth - 20, blockHeight, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(14)
      pdf.text(`${m.name}: ${m.value}`, 15, y + 14)
      y += blockHeight + 5
    })

    pdf.save('planta_profissional.pdf')
  }
}


  return (
    <div style={{ display: 'flex', gap: 12, width: '100%' }}>
      <div className="panel" style={{ flex: 1 }}>
        <div className="controls">
          <button className="btnopcoes" onClick={() => loadPreset('room')}>Preset Sala</button>
          <button className="btnopcoes" onClick={() => loadPreset('line')}>Preset Linha</button>
          <button className="btnopcoes" onClick={clearAll}>Limpar</button>
          <button className="btnopcoes" onClick={undo}>Desfazer</button>
          <button className="btnopcoes" onClick={exportPDF}>Exportar PDF Profissional</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>Escala (px/m): </label>
          <input type="number" value={pxPerMeter} onChange={e => setPxPerMeter(Number(e.target.value) || 1)} />
          <label style={{ marginLeft: 12 }}>Altura paredes (m): </label>
          <input type="number" step="0.1" value={wallHeight} onChange={e => setWallHeight(Number(e.target.value) || 0)} />
        </div>

        <div className="canvas-wrap" style={{ marginTop: 12 }}>
          <Stage width={900} height={600} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} ref={stageRef}>
            <Layer>
              {walls.map((w, i) => (
                <Group key={i}>
                  <Line
                    points={[w.x1, w.y1, w.x2, w.y2]}
                    stroke={selectedWall===i ? '#f87171' : '#7dd3fc'}
                    strokeWidth={6}
                    lineCap="round"
                    onClick={() => { setSelectedWall(i) }}
                    onDblClick={() => deleteWall(i)}
                    onMouseDown={e=>handleWallDragStart(e,i)}
                  />
                  <Text x={midPoint(w).x+6} y={midPoint(w).y-10} text={`${formatNumber(distance({x:w.x1,y:w.y1},{x:w.x2,y:w.y2})/pxPerMeter)} m`} fontSize={14} fill="#cbd5e1" />
                  <Circle x={w.x1} y={w.y1} radius={6} fill="#34d399" draggable onDragMove={e=>handleVertexDrag(e,i,'start')} />
                  <Circle x={w.x2} y={w.y2} radius={6} fill="#34d399" draggable onDragMove={e=>handleVertexDrag(e,i,'end')} />
                  {w.openings?.map((o,j)=> {
                    const dx = w.x2 - w.x1
                    const dy = w.y2 - w.y1
                    const wallLength = Math.sqrt(dx*dx+dy*dy)
                    const angle = Math.atan2(dy,dx)
                    const x = w.x1 + dx*o.pos
                    const y = w.y1 + dy*o.pos
                    const width = o.widthMeters * pxPerMeter
                    const xEnd = x + (dx/wallLength)*width
                    const yEnd = y + (dy/wallLength)*width
                    return (
                      <Group key={j}>
                        <Rect x={x} y={y-5} width={width} height={10} fill={o.type==='door'?'#fbbf24':'#3b82f6'} rotation={angle*180/Math.PI} draggable onDragMove={e=>handleOpeningDrag(e,i,j)} />
                        <Circle x={x} y={y} radius={5} fill="#f87171" draggable onDragMove={e=>handleOpeningResize(e,i,j,'start')} />
                        <Circle x={xEnd} y={yEnd} radius={5} fill="#34d399" draggable onDragMove={e=>handleOpeningResize(e,i,j,'end')} />
                      </Group>
                    )
                  })}
                </Group>
              ))}
              {drawing && currentStart && currentEnd && (
                <>
                  <Line points={[currentStart.x,currentStart.y,currentEnd.x,currentEnd.y]} stroke="#34d399" strokeWidth={4} dash={[10,6]} />
                  <Circle x={currentStart.x} y={currentStart.y} radius={6} fill="#fef3c7" />
                  <Circle x={currentEnd.x} y={currentEnd.y} radius={6} fill="#fef3c7" />
                </>
              )}
            </Layer>
          </Stage>
        </div>
      </div>

      <div className="panel" style={{ width: 320 }}>
        <h3>Resumo</h3>
        <div className="info">
          <div className="stat"><div className="small">Comprimento total</div><div style={{fontWeight:700}}>{formatNumber(totalLengthM)} m²</div></div>
          <div className="stat"><div className="small">Área de paredes</div><div style={{fontWeight:700}}>{formatNumber(wallArea)} m² x a</div></div>
          <div className="stat"><div className="small">Blocos</div><div style={{fontWeight:700}}>{bricksWithLoss} un</div></div>
          <div className="stat"><div className="small">Argamassa</div><div style={{fontWeight:700}}>{formatNumber(mortarVolume)} m³</div></div>
          <div className="stat"><div className="small">Areia</div><div style={{fontWeight:700}}>{formatNumber(sandVolume)} m³</div></div>
          <div className="stat"><div className="small">Cimento</div><div style={{fontWeight:700}}>{formatNumber(cementKg)} kg</div></div>
          <div className="stat"><div className="small">Ferragem</div><div style={{fontWeight:700}}>{formatNumber(steelKg)} kg</div></div>
          <div className="stat"><div className="small">Reboco</div><div style={{fontWeight:700}}>{formatNumber(plasterKg)} kg</div></div>
          <div className="stat"><div className="small">Tinta</div><div style={{fontWeight:700}}>{formatNumber(paintL)} L</div></div>
        </div>

        <div style={{ marginTop: 12 }}>
  <h4>Adicionar Aberturas</h4>
  {openingTypes.door.map((d,i)=>(
    <button
      key={`d${i}`}
      onClick={()=>addOpening(selectedWall ?? 0,'door',d.widthMeters)}
      className="btn btn-block btn-door"
      disabled={selectedWall === null}
    >
      {d.name}
    </button>
  ))}
  {openingTypes.window.map((w,i)=>(
    <button
      key={`w${i}`}
      onClick={()=>addOpening(selectedWall ?? 0,'window',w.widthMeters)}
      className="btn btn-block btn-window"
      disabled={selectedWall === null}
    >
      {w.name}
    </button>
  ))}
</div>

<button className="btn btn-toggle" onClick={()=>setShowDetails(!showDetails)}>
  {showDetails ? 'Ocultar detalhes por parede' : 'Mostrar detalhes por parede'}
</button>


        {showDetails && (
  <div className="details">
    {walls.map((w, i) => {
      const lengthM = distance({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }) / pxPerMeter
      const areaM2 = lengthM * wallHeight - (w.openings?.reduce((a, o) => a + o.widthMeters * wallHeight, 0) || 0)
      const bricks = Math.ceil(areaM2 * brickPerM2 * (1 + lossPercent / 100))
      const mortar = areaM2 * 0.03
      const sand = mortar * 0.5
      const cement = mortar * 180
      const steel = areaM2 * 2
      const plaster = areaM2 * 5
      const paint = areaM2 * 0.2
      return (
        <div key={i} className="detail-card">
          <div className="detail-header">Parede {i + 1}</div>
          <div className="detail-grid">
            <div><span>Comprimento:</span> {formatNumber(lengthM)} m</div>
            <div><span>Área:</span> {formatNumber(areaM2)} m²</div>
            <div><span>Blocos:</span> {bricks}</div>
            <div><span>Argamassa:</span> {formatNumber(mortar)} m³</div>
            <div><span>Areia:</span> {formatNumber(sand)} m³</div>
            <div><span>Cimento:</span> {formatNumber(cement)} kg</div>
            <div><span>Ferragem:</span> {formatNumber(steel)} kg</div>
            <div><span>Reboco:</span> {formatNumber(plaster)} kg</div>
            <div><span>Tinta:</span> {formatNumber(paint)} L</div>
            <div className="openings">
              <span>Aberturas:</span> {w.openings?.map(o => `${o.type} (${o.widthMeters.toFixed(2)} m)`).join(', ') || 'Nenhuma'}
            </div>
          </div>
        </div>
      )
    })}
  </div>
)}

      </div>
    </div>
  )
}

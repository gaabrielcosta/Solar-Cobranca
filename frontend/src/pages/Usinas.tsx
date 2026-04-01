import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileText, CheckCircle, XCircle, Loader, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResultadoFatura {
  arquivo: string
  sucesso: boolean
  mensagem: string
  cliente?: string
  uc?: string
  valor_final?: number
  competencia?: string
}

interface PreviewDemonstrativo {
  usina_id: string
  usina_nome: string
  dados_extraidos: {
    uc_geradora: string
    competencia: string
    kwh_injetado: number
    saldo_anterior: number
    saldo_disponivel: number
    beneficiarios: { uc: string; percentual: number; kwh_transferido: number }[]
  }
}

type Aba = 'cliente' | 'usina'

export default function UploadFaturas() {
  const [aba, setAba] = useState<Aba>('cliente')
  const [subAba, setSubAba] = useState<'pdf' | 'manual'>('pdf')

  const [arquivos, setArquivos] = useState<File[]>([])
  const [resultados, setResultados] = useState<ResultadoFatura[]>([])
  const [processando, setProcessando] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [formManual, setFormManual] = useState({
    uc: '', competencia: '', kwh_compensado: '', tarifa_kwh: '',
    kwh_consumo_energisa: '', cip: '', outros: '', total_fatura_energisa: '', saldo_credito: ''
  })
  const [loadingManual, setLoadingManual] = useState(false)
  const [resultadoManual, setResultadoManual] = useState<{ sucesso: boolean; mensagem: string } | null>(null)
  const [erroManual, setErroManual] = useState('')

  const [dragOverUsina, setDragOverUsina] = useState(false)
  const [loadingUsina, setLoadingUsina] = useState(false)
  const [preview, setPreview] = useState<PreviewDemonstrativo | null>(null)
  const [resultadoUsina, setResultadoUsina] = useState<{ sucesso: boolean; mensagem: string } | null>(null)
  const inputUsinaRef = useRef<HTMLInputElement>(null)
  const [erroUsina, setErroUsina] = useState('')

  function selecionarArquivos(files: FileList | null) {
    if (!files) return
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf')
    setArquivos(prev => {
      const nomes = new Set(prev.map(f => f.name))
      return [...prev, ...pdfs.filter(f => !nomes.has(f.name))]
    })
  }

  function removerArquivo(nome: string) {
    setArquivos(prev => prev.filter(f => f.name !== nome))
  }

  async function processarPDFs() {
    if (arquivos.length === 0) return
    setProcessando(true)
    setResultados([])
    const token = localStorage.getItem('token')
    const novosResultados: ResultadoFatura[] = []
    for (const arquivo of arquivos) {
      const formData = new FormData()
      formData.append('pdf', arquivo)
      try {
        const res = await fetch('/api/faturas/processar-pdf', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        const data = await res.json()
        novosResultados.push({
          arquivo: arquivo.name,
          sucesso: res.ok && data.sucesso,
          mensagem: data.erro || data.mensagem || (res.ok ? 'Processado com sucesso' : 'Erro desconhecido'),
          cliente: data.cliente,
          uc: data.uc,
          valor_final: data.valor_final,
          competencia: data.competencia,
        })
      } catch {
        novosResultados.push({ arquivo: arquivo.name, sucesso: false, mensagem: 'Erro ao enviar arquivo' })
      }
      setResultados([...novosResultados])
    }
    setProcessando(false)
  }

  async function enviarManual() {
    if (!formManual.uc || !formManual.competencia || !formManual.kwh_compensado || !formManual.tarifa_kwh) {
      setErroManual('UC, competência, kWh e tarifa são obrigatórios')
      return
    }
    setErroManual('')
    setLoadingManual(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch('/api/faturas/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uc: formManual.uc,
          competencia: formManual.competencia,
          kwh_compensado: Number(formManual.kwh_compensado),
          tarifa_kwh: Number(formManual.tarifa_kwh),
          kwh_consumo_energisa: Number(formManual.kwh_consumo_energisa) || 0,
          cip: Number(formManual.cip) || 0,
          outros: Number(formManual.outros) || 0,
          total_fatura_energisa: Number(formManual.total_fatura_energisa) || 0,
          saldo_credito: Number(formManual.saldo_credito) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.sucesso) {
        setErroManual(data.erro || 'Erro ao salvar fatura')
        return
      }
      setResultadoManual({ sucesso: true, mensagem: data.mensagem || 'Fatura gerada com sucesso' })
      setFormManual({ uc: '', competencia: '', kwh_compensado: '', tarifa_kwh: '', kwh_consumo_energisa: '', cip: '', outros: '', total_fatura_energisa: '', saldo_credito: '' })
    } catch {
      setErroManual('Erro ao conectar com o servidor')
    } finally {
      setLoadingManual(false)
    }
  }

  async function enviarDemonstrativo(file: File) {
    setLoadingUsina(true)
    setErroUsina('')
    setPreview(null)
    setResultadoUsina(null)
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('pdf', file)
    try {
      const res = await fetch('/api/upload/demonstrativo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.sucesso) {
        setErroUsina(data.erro || 'Erro ao ler PDF')
        return
      }
      setPreview(data)
    } catch {
      setErroUsina('Erro ao enviar arquivo')
    } finally {
      setLoadingUsina(false)
    }
  }

  async function processarDemonstrativo() {
    if (!preview) return
    setErroUsina('')
    const token = localStorage.getItem('token')
    try {
      const res = await fetch('/api/upload/processar-demonstrativo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usina_id: preview.usina_id,
          dados_extraidos: preview.dados_extraidos,
          tarifa_kwh: 0,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.sucesso) {
        setErroUsina(data.erro || 'Erro ao processar demonstrativo')
        return
      }
      setResultadoUsina({ sucesso: true, mensagem: data.mensagem || 'Demonstrativo processado com sucesso' })
      setPreview(null)
    } catch {
      setErroUsina('Erro ao processar demonstrativo')
    }
  }

  const sucessos = resultados.filter(r => r.sucesso).length
  const erros    = resultados.filter(r => !r.sucesso).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload de PDFs</h1>
        <p className="text-muted-foreground text-sm mt-1">Processa PDFs da Energisa MS automaticamente</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setAba('cliente')}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            aba === 'cliente' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
        >
          Fatura do cliente
        </button>
        <button
          onClick={() => setAba('usina')}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            aba === 'usina' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
        >
          Demonstrativo da usina
        </button>
      </div>

      {aba === 'cliente' && (
        <>
          <div className="flex gap-0 border border-border rounded-lg overflow-hidden w-fit">
            <button
              onClick={() => setSubAba('pdf')}
              className={cn('px-4 py-2 text-sm font-medium transition-colors',
                subAba === 'pdf' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              PDF automático
            </button>
            <button
              onClick={() => setSubAba('manual')}
              className={cn('px-4 py-2 text-sm font-medium border-l border-border transition-colors',
                subAba === 'manual' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              Entrada manual
            </button>
          </div>

          {subAba === 'pdf' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); selecionarArquivos(e.dataTransfer.files) }}
                onClick={() => inputRef.current?.click()}
                className={cn('border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors',
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30')}
              >
                <Upload size={32} className="text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Arraste os PDFs aqui</p>
                  <p className="text-sm text-muted-foreground mt-1">Faturas Energisa dos clientes — múltiplos arquivos</p>
                </div>
                <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={e => selecionarArquivos(e.target.files)} />
              </div>

              {arquivos.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{arquivos.length} arquivo{arquivos.length !== 1 ? 's' : ''} selecionado{arquivos.length !== 1 ? 's' : ''}</p>
                    <Button onClick={processarPDFs} disabled={processando}>
                      {processando ? <><Loader size={16} className="animate-spin" />Processando...</> : <><FileText size={16} />Processar {arquivos.length} PDF{arquivos.length !== 1 ? 's' : ''}</>}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {arquivos.map(f => {
                      const resultado = resultados.find(r => r.arquivo === f.name)
                      return (
                        <div key={f.name} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                          {resultado ? (
                            resultado.sucesso ? <CheckCircle size={18} className="text-green-500 flex-shrink-0" /> : <XCircle size={18} className="text-destructive flex-shrink-0" />
                          ) : processando ? (
                            <Loader size={18} className="animate-spin text-muted-foreground flex-shrink-0" />
                          ) : (
                            <FileText size={18} className="text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{f.name}</p>
                            {resultado && (
                              <p className={cn('text-xs mt-0.5', resultado.sucesso ? 'text-green-500' : 'text-destructive')}>
                                {resultado.sucesso
                                  ? `${resultado.cliente} — UC ${resultado.uc} — R$ ${Number(resultado.valor_final).toFixed(2).replace('.', ',')} — ${resultado.competencia}`
                                  : resultado.mensagem}
                              </p>
                            )}
                          </div>
                          {!processando && !resultado && (
                            <button onClick={e => { e.stopPropagation(); removerArquivo(f.name) }} className="text-muted-foreground hover:text-destructive transition-colors">
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {resultados.length > 0 && !processando && (
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="text-sm"><span className="font-medium">{sucessos}</span> processado{sucessos !== 1 ? 's' : ''}</span>
                  </div>
                  {erros > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle size={16} className="text-destructive" />
                      <span className="text-sm"><span className="font-medium">{erros}</span> erro{erros !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <Button variant="outline" className="ml-auto" onClick={() => { setArquivos([]); setResultados([]) }}>Limpar</Button>
                </div>
              )}
            </>
          )}

          {subAba === 'manual' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Use quando o PDF não for lido corretamente. Os valores devem ser retirados diretamente da fatura impressa da Energisa.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">UC do cliente *</label>
                  <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="ex: 3647072" value={formManual.uc} onChange={e => setFormManual(p => ({ ...p, uc: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Competência *</label>
                  <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="MM/AAAA" value={formManual.competencia} onChange={e => setFormManual(p => ({ ...p, competencia: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">kWh compensados (GDII) *</label>
                  <input type="number" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="ex: 2520" value={formManual.kwh_compensado} onChange={e => setFormManual(p => ({ ...p, kwh_compensado: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Tarifa kWh (Energisa) *</label>
                  <input type="number" step="0.000001" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono" placeholder="ex: 1.092920" value={formManual.tarifa_kwh} onChange={e => setFormManual(p => ({ ...p, tarifa_kwh: e.target.value }))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground border-t border-border pt-4">Informativos (opcional)</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Consumo Energisa (kWh)</label>
                  <input type="number" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="ex: 4349" value={formManual.kwh_consumo_energisa} onChange={e => setFormManual(p => ({ ...p, kwh_consumo_energisa: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">CIP Municipal (R$)</label>
                  <input type="number" step="0.01" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="ex: 302.22" value={formManual.cip} onChange={e => setFormManual(p => ({ ...p, cip: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Multa/Juros (R$)</label>
                  <input type="number" step="0.01" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" placeholder="ex: 88.62" value={formManual.outros} onChange={e => setFormManual(p => ({ ...p, outros: e.target.value }))} />
                </div>
              </div>
              {erroManual && <p className="text-sm text-destructive">{erroManual}</p>}
              {resultadoManual && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                  <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-500">{resultadoManual.mensagem}</p>
                  <Button variant="outline" className="ml-auto" onClick={() => setResultadoManual(null)}>Nova entrada</Button>
                </div>
              )}
              <Button onClick={enviarManual} disabled={loadingManual} className="w-fit">
                {loadingManual ? <><Loader size={16} className="animate-spin" />Salvando...</> : 'Gerar fatura manualmente'}
              </Button>
            </div>
          )}
        </>
      )}

      {aba === 'usina' && (
        <>
          {!preview && !resultadoUsina && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOverUsina(true) }}
              onDragLeave={() => setDragOverUsina(false)}
              onDrop={e => {
                e.preventDefault(); setDragOverUsina(false)
                const file = e.dataTransfer.files[0]
                if (file?.type === 'application/pdf') { enviarDemonstrativo(file) }
              }}
              onClick={() => inputUsinaRef.current?.click()}
              className={cn('border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors',
                dragOverUsina ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30')}
            >
              <Sun size={32} className="text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Arraste o PDF do demonstrativo</p>
                <p className="text-sm text-muted-foreground mt-1">Demonstrativo de compensação da usina — 1 arquivo</p>
              </div>
              <input ref={inputUsinaRef} type="file" accept=".pdf" className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (file) { enviarDemonstrativo(file) }
              }} />
            </div>
          )}

          {loadingUsina && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
              <Loader size={18} className="animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Lendo PDF do demonstrativo...</p>
            </div>
          )}

          {erroUsina && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <XCircle size={18} className="text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{erroUsina}</p>
              <Button variant="outline" className="ml-auto" onClick={() => setErroUsina('')}>Tentar novamente</Button>
            </div>
          )}

          {preview && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-500" />
                  <p className="font-medium text-sm">PDF lido com sucesso — confirme os dados</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Usina</p>
                    <p className="font-medium">{preview.usina_nome}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Competência</p>
                    <p className="font-medium">{preview.dados_extraidos.competencia}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">kWh injetado</p>
                    <p className="font-medium">{preview.dados_extraidos.kwh_injetado} kWh</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Saldo disponível</p>
                    <p className="font-medium">{preview.dados_extraidos.saldo_disponivel} kWh</p>
                  </div>
                </div>
              </div>

              {preview.dados_extraidos.beneficiarios?.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">UC</th>
                        <th className="text-left px-4 py-3 font-medium">kWh transferido</th>
                        <th className="text-left px-4 py-3 font-medium">Percentual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.dados_extraidos.beneficiarios.map((b, i) => (
                        <tr key={b.uc} className={cn('border-t border-border', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                          <td className="px-4 py-2 font-mono text-xs">{b.uc}</td>
                          <td className="px-4 py-2 text-muted-foreground">{b.kwh_transferido} kWh</td>
                          <td className="px-4 py-2 text-muted-foreground">{b.percentual}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {erroUsina && <p className="text-sm text-destructive">{erroUsina}</p>}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setPreview(null); setErroUsina('') }}>Cancelar</Button>
                <Button onClick={processarDemonstrativo}>Confirmar e salvar</Button>
              </div>
            </div>
          )}

          {resultadoUsina && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
              <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-500">{resultadoUsina.mensagem}</p>
              <Button variant="outline" className="ml-auto" onClick={() => setResultadoUsina(null)}>Processar outro</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
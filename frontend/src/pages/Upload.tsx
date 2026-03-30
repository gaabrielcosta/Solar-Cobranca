import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileText, CheckCircle, XCircle, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Resultado {
  arquivo: string
  sucesso: boolean
  mensagem: string
  cliente?: string
  uc?: string
  valor_final?: number
  competencia?: string
}

export default function UploadFaturas() {
  const [arquivos, setArquivos] = useState<File[]>([])
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [processando, setProcessando] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    const novosResultados: Resultado[] = []

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
        novosResultados.push({
          arquivo: arquivo.name,
          sucesso: false,
          mensagem: 'Erro ao enviar arquivo',
        })
      }

      setResultados([...novosResultados])
    }

    setProcessando(false)
  }

  const sucessos  = resultados.filter(r => r.sucesso).length
  const erros     = resultados.filter(r => !r.sucesso).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload de faturas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Processa PDFs da Energisa MS e gera as cobranças automaticamente
        </p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); selecionarArquivos(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
      >
        <Upload size={32} className="text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">Arraste os PDFs aqui</p>
          <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={e => selecionarArquivos(e.target.files)}
        />
      </div>

      {arquivos.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{arquivos.length} arquivo{arquivos.length !== 1 ? 's' : ''} selecionado{arquivos.length !== 1 ? 's' : ''}</p>
            <Button onClick={processarPDFs} disabled={processando}>
              {processando ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <FileText size={16} />
                  Processar {arquivos.length} PDF{arquivos.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {arquivos.map(f => {
              const resultado = resultados.find(r => r.arquivo === f.name)
              return (
                <div
                  key={f.name}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  {resultado ? (
                    resultado.sucesso
                      ? <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                      : <XCircle size={18} className="text-destructive flex-shrink-0" />
                  ) : processando ? (
                    <Loader size={18} className="animate-spin text-muted-foreground flex-shrink-0" />
                  ) : (
                    <FileText size={18} className="text-muted-foreground flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    {resultado && (
                      <p className={cn(
                        'text-xs mt-0.5',
                        resultado.sucesso ? 'text-green-500' : 'text-destructive'
                      )}>
                        {resultado.sucesso
                          ? `${resultado.cliente} — UC ${resultado.uc} — R$ ${Number(resultado.valor_final).toFixed(2).replace('.', ',')} — ${resultado.competencia}`
                          : resultado.mensagem
                        }
                      </p>
                    )}
                  </div>

                  {!processando && !resultado && (
                    <button
                      onClick={e => { e.stopPropagation(); removerArquivo(f.name) }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
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
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => { setArquivos([]); setResultados([]) }}
          >
            Limpar
          </Button>
        </div>
      )}
    </div>
  )
}
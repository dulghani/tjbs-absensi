import { useEffect, useState, useRef } from 'react'
import { Upload, X, Save, Factory } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { getAppSettings, updateAppSettings } from '../../api/realService'
import { Card, CardHeader, CardTitle, CardBody, Input } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import { toast } from '../../components/ui/Toast'

export default function AppSettingsPage() {
  const setAppSettings = useAppStore(s => s.setAppSettings)
  const appSettings    = useAppStore(s => s.appSettings)
  const [appName, setAppName] = useState('')
  const [preview, setPreview] = useState(null)  // preview URL file baru
  const [logoFile, setLogoFile] = useState(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    setAppName(appSettings?.app_name || 'OutsourceHR')
    setPreview(appSettings?.app_logo || null)
  }, [appSettings])

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setRemoveLogo(false)
    setPreview(URL.createObjectURL(file))
  }

  function handleRemoveLogo() {
    setLogoFile(null)
    setPreview(null)
    setRemoveLogo(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('app_name', appName)
      if (logoFile) fd.append('logo', logoFile)
      if (removeLogo) fd.append('remove_logo', '1')

      const updated = await updateAppSettings(fd)
      if (updated) {
        setAppSettings(updated)
        toast.success('Pengaturan berhasil disimpan')
        // Update document title
        document.title = updated.app_name || 'OutsourceHR'
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan pengaturan')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Pengaturan Aplikasi</h2>
        <p className="text-sm text-gray-500 mt-0.5">Atur nama dan logo aplikasi yang tampil di sidebar</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Identitas Aplikasi</CardTitle></CardHeader>
        <CardBody className="space-y-5">
          {/* Nama Aplikasi */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Nama Aplikasi</label>
            <input
              type="text" value={appName} onChange={e => setAppName(e.target.value)}
              maxLength={80} placeholder="OutsourceHR"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-white"
            />
            <p className="text-[11px] text-gray-400 mt-1">Nama ini tampil di sidebar dan tab browser</p>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Logo</label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="w-14 h-14 rounded-xl bg-brand flex items-center justify-center overflow-hidden border border-gray-200 flex-shrink-0">
                {preview
                  ? <img src={preview} alt="logo" className="w-full h-full object-cover" />
                  : <Factory size={24} className="text-white" />
                }
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                  >
                    <Upload size={13} /> Upload Logo
                  </button>
                  {preview && (
                    <button onClick={handleRemoveLogo} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 rounded-lg hover:bg-red-50 text-red-500">
                      <X size={13} /> Hapus
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">PNG/JPG, maks 2MB. Tampil 32×32px di sidebar.</p>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
            </div>
          </div>

          {/* Preview sidebar */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-[11px] text-gray-400 mb-3">Preview sidebar:</p>
            <div className="flex items-center gap-2.5 bg-white rounded-lg px-3 py-2 border border-gray-100 w-fit">
              <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center overflow-hidden flex-shrink-0">
                {preview
                  ? <img src={preview} alt="logo" className="w-full h-full object-cover" />
                  : <Factory size={13} className="text-white" />
                }
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900 leading-none">{appName || 'OutsourceHR'}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">v1.0.0</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <Button variant="primary" icon={Save} loading={saving} onClick={handleSave}>
              Simpan Pengaturan
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

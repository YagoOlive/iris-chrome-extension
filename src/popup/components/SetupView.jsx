// src/popup/components/SetupView.jsx

import { useState, useRef, useEffect } from 'react';
import '../styles/SetupView.css';

export default function SetupView({ onSetupComplete }) {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [calibrationDone, setCalibrationDone] = useState(false);

  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  // Verificar estado da calibração + abrir câmera automaticamente se já permitida
  useEffect(() => {
    chrome.storage.local.get(['calibrationDone', 'autoEnableCamera'], async (items) => {
      if (items.calibrationDone) setCalibrationDone(true);

      const { state } = await navigator.permissions.query({ name: 'camera' });
      if (state === 'granted') {
        setLoadingCamera(true);
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: true });
          setStream(s);
          setCameraEnabled(true);
        } catch (err) {
          console.error('Erro ao abrir câmera automaticamente:', err);
        } finally {
          setLoadingCamera(false);
        }
        return;
      }

      if (items.autoEnableCamera === 'denied') {
        chrome.storage.local.remove('autoEnableCamera');
        alert('Permissão de câmera bloqueada. Vá em Detalhes da extensão → Configurações do site → Câmera → Permitir.');
      } else if (items.autoEnableCamera === 'prompt') {
        chrome.storage.local.remove('autoEnableCamera');
        alert('O rastreamento precisa de acesso permanente à câmera. Quando o Chrome perguntar, escolha "Permitir ao visitar este site".');
      }
    });
  }, []);

  // Detectar conclusão da calibração feita na aba dedicada
  useEffect(() => {
    const handler = (changes) => {
      if (changes.calibrationDone?.newValue === true) {
        setCalibrationDone(true);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // Conectar stream ao elemento de vídeo
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  async function ensureCameraPermission() {
    const { state } = await navigator.permissions.query({ name: 'camera' });
    if (state === 'granted') return true;
    if (state === 'prompt') {
      await chrome.runtime.openOptionsPage();
      return new Promise(resolve => {
        const listener = (msg) => {
          if (msg.cmd === 'CAMERA_GRANTED') resolve(true);
          else if (msg.cmd === 'CAMERA_PROMPT') resolve(false);
          chrome.runtime.onMessage.removeListener(listener);
        };
        chrome.runtime.onMessage.addListener(listener);
      });
    }
    return false;
  }

  async function handleToggleCamera(e) {
    const wantOn = e.target.checked;
    if (wantOn) {
      setLoadingCamera(true);
      const ok = await ensureCameraPermission();
      if (!ok) {
        alert('Permissão de câmera bloqueada. Vá em Detalhes da extensão → Configurações do site → Câmera → Permitir.');
        e.target.checked = false;
        setLoadingCamera(false);
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(s);
        setCameraEnabled(true);
      } catch (err) {
        console.error('getUserMedia falhou:', err);
        alert('Não foi possível acessar a câmera. Verifique as configurações de privacidade do navegador ou do sistema.');
        e.target.checked = false;
      } finally {
        setLoadingCamera(false);
      }
    } else {
      stream?.getTracks().forEach(t => t.stop());
      setCameraEnabled(false);
      setStream(null);
    }
  }

  async function handleOpenCalibration() {
    if (!cameraEnabled) {
      alert('Ative a câmera primeiro.');
      return;
    }
    await chrome.runtime.sendMessage({ cmd: 'START_CALIBRATION' });
    chrome.tabs.create({ url: chrome.runtime.getURL('src/calibration/index.html') });
  }

  async function handleStart() {
    if (!cameraEnabled) return alert('Ative a câmera primeiro.');
    if (!calibrationDone) return alert('Execute a calibração primeiro.');

    const { config } = await chrome.storage.local.get('config');
    await chrome.runtime.sendMessage({ cmd: 'START_TRACKING', config });
    onSetupComplete();
    window.close();
  }

  return (
    <>
      <h2>Configuração do Rastreamento</h2>

      {/* Toggle da câmera */}
      <div className="toggle-container">
        <label className="switch-label">
          <input
            type="checkbox"
            checked={cameraEnabled}
            onChange={handleToggleCamera}
            disabled={loadingCamera}
          />
          <span className="switch-slider"></span>
          <span className="switch-text">Ativar Câmera</span>
          {loadingCamera && <span className="spinner" aria-hidden="true" />}
        </label>
      </div>

      {cameraEnabled && (
        <video ref={videoRef} autoPlay playsInline muted className="video-preview" />
      )}

      {/* Status da calibração */}
      <div className="calibration-status">
        {calibrationDone
          ? <span className="status-badge status-badge--ok">✓ Calibração salva</span>
          : <span className="status-badge status-badge--warn">Nenhuma calibração ainda</span>
        }
      </div>

      {/* Botão de calibração — abre aba dedicada */}
      <button
        onClick={handleOpenCalibration}
        disabled={!cameraEnabled || loadingCamera}
        className="btn-secondary"
      >
        {calibrationDone ? 'Recalibrar' : 'Executar Calibração'}
      </button>

      {/* Botão iniciar */}
      <button
        disabled={!cameraEnabled || !calibrationDone || loadingCamera}
        onClick={handleStart}
      >
        Iniciar Rastreamento
      </button>
    </>
  );
}

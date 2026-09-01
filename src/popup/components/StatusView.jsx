// src/popup/components/StatusView.jsx

import { useState, useEffect } from 'react';
import '../styles/StatusView.css';

const gestureOptions = [
  { value: 'smile',       label: 'Sorrir' },
  { value: 'smileLeft',   label: 'Sorrir para a esquerda' },
  { value: 'smileRight',  label: 'Sorrir para a direita' },
  { value: 'browUp',      label: 'Levantar sobrancelhas' },
  { value: 'browDown',    label: 'Abaixar sobrancelhas' },
  { value: 'jawOpen',     label: 'Abrir a boca' },
  { value: 'mouthPucker', label: 'Franzir os lábios' },
  { value: 'showTeeth',   label: 'Mostrar os dentes' },
  { value: 'lookLeft',    label: 'Olhar para a esquerda' },
  { value: 'lookRight',   label: 'Olhar para a direita' },
  { value: 'lookUp',      label: 'Olhar para cima' },
  { value: 'lookDown',    label: 'Olhar para baixo' },
];

const clickActionDescriptions = {
  '':           'Selecione um gesto facial para acionar um clique.',
  smile:        'Sorria para realizar um clique.',
  smileLeft:    'Sorria apenas para a esquerda para clicar.',
  smileRight:   'Sorria apenas para a direita para clicar.',
  browUp:       'Levante as sobrancelhas para clicar.',
  browDown:     'Abaixe as sobrancelhas para clicar.',
  jawOpen:      'Abra bem a boca para clicar.',
  showTeeth:    'Mostre todos os dentes para clicar.',
  lookLeft:     'Olhe para a esquerda com os olhos para clicar.',
  lookRight:    'Olhe para a direita com os olhos para clicar.',
  lookUp:       'Olhe para cima com os olhos para clicar.',
  lookDown:     'Olhe para baixo com os olhos para clicar.',
  mouthPucker:  'Franzir os lábios para clicar.',
};

const doubleClickActionDescriptions = {
  '':           'Selecione um gesto facial para acionar um clique duplo.',
  smile:        'Sorria para realizar um clique duplo.',
  smileLeft:    'Sorria apenas para a esquerda para clique duplo.',
  smileRight:   'Sorria apenas para a direita para clique duplo.',
  browUp:       'Levante as sobrancelhas para clique duplo.',
  browDown:     'Abaixe as sobrancelhas para clique duplo.',
  jawOpen:      'Abra bem a boca para clique duplo.',
  showTeeth:    'Mostre todos os dentes para clique duplo.',
  lookLeft:     'Olhe para a esquerda com os olhos para clique duplo.',
  lookRight:    'Olhe para a direita com os olhos para clique duplo.',
  lookUp:       'Olhe para cima com os olhos para clique duplo.',
  lookDown:     'Olhe para baixo com os olhos para clique duplo.',
  mouthPucker:  'Franzir os lábios para clique duplo.',
};

const rightClickActionDescriptions = {
  '':           'Selecione um gesto para abrir o menu de contexto (clique direito).',
  smile:        'Sorria para abrir o menu de contexto.',
  smileLeft:    'Sorria apenas para a esquerda para o menu de contexto.',
  smileRight:   'Sorria apenas para a direita para o menu de contexto.',
  browUp:       'Levante as sobrancelhas para o menu de contexto.',
  browDown:     'Abaixe as sobrancelhas para o menu de contexto.',
  jawOpen:      'Abra bem a boca para o menu de contexto.',
  showTeeth:    'Mostre todos os dentes para o menu de contexto.',
  lookLeft:     'Olhe para a esquerda com os olhos para o menu de contexto.',
  lookRight:    'Olhe para a direita com os olhos para o menu de contexto.',
  lookUp:       'Olhe para cima com os olhos para o menu de contexto.',
  lookDown:     'Olhe para baixo com os olhos para o menu de contexto.',
  mouthPucker:  'Franzir os lábios para o menu de contexto.',
};

export default function StatusView({ onStop }) {
  const [factor,            setFactor]           = useState(0.95);
  const [cursorSprite,      setCursorSprite]     = useState('arrow');
  const [clickAction,       setClickAction]      = useState('smile');
  const [doubleClickAction, setDoubleClickAction]= useState('');
  const [rightClickAction,  setRightClickAction] = useState('');

  const [clickAssist,       setClickAssist]       = useState(false);
  const [clickTimeout,      setClickTimeout]      = useState(1000);
  const [clickRadius,       setClickRadius]       = useState(100);
  const [clickRadiusError,  setClickRadiusError]  = useState(false);
  const [clickTimeoutError, setClickTimeoutError] = useState(false);

  const [dwellClick,     setDwellClick]     = useState(false);
  const [dwellTime,      setDwellTime]      = useState(3000);
  const [dwellArea,      setDwellArea]      = useState(40);
  const [dwellTimeError, setDwellTimeError] = useState(false);
  const [dwellAreaError, setDwellAreaError] = useState(false);

  // Carregar configurações salvas ao abrir
  useEffect(() => {
    chrome.storage.local.get(
      ['exponentialSmoothingFactor', 'cursorSprite', 'clickAction', 'doubleClickAction',
       'rightClickAction', 'clickAssist', 'clickTimeout', 'clickRadius',
       'dwellClick', 'dwellTime', 'dwellArea'],
      (items) => {
        if (typeof items.exponentialSmoothingFactor === 'number') setFactor(items.exponentialSmoothingFactor);
        if (typeof items.cursorSprite       === 'string') setCursorSprite(items.cursorSprite);
        if (typeof items.clickAction        === 'string') setClickAction(items.clickAction);
        if (typeof items.doubleClickAction  === 'string') setDoubleClickAction(items.doubleClickAction);
        if (typeof items.rightClickAction   === 'string') setRightClickAction(items.rightClickAction);
        if (items.clickAssist) setClickAssist(true);
        if (typeof items.clickTimeout === 'number') setClickTimeout(items.clickTimeout);
        if (typeof items.clickRadius  === 'number') setClickRadius(items.clickRadius);
        if (items.clickTimeout < 100 || items.clickTimeout > 10000) setClickTimeoutError(true);
        if (items.clickRadius  < 30  || items.clickRadius  > 500)   setClickRadiusError(true);
        if (items.dwellClick) setDwellClick(true);
        if (typeof items.dwellTime === 'number') setDwellTime(items.dwellTime);
        if (typeof items.dwellArea === 'number') setDwellArea(items.dwellArea);
        if (items.dwellTime < 300 || items.dwellTime > 5000) setDwellTimeError(true);
        if (items.dwellArea < 3   || items.dwellArea > 100)  setDwellAreaError(true);
      }
    );
  }, []);

  function broadcast(key, value) {
    chrome.storage.local.set({ [key]: value });
    chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', [key]: value });
  }

  // Suavização
  const handleSlider = (e) => setFactor(Number(e.target.value));
  useEffect(() => {
    const t = setTimeout(() => broadcast('exponentialSmoothingFactor', factor), 500);
    return () => clearTimeout(t);
  }, [factor]);

  // Estilo do cursor
  const handleCursorSpriteChange = (next) => {
    const value = next === 'disc' ? 'disc' : 'arrow';
    if (value === cursorSprite) return;
    setCursorSprite(value);
    broadcast('cursorSprite', value);
  };

  // Gestos de clique
  const handleClickActionChange = (e) => {
    const val = e.target.value;
    setClickAction(val);
    broadcast('clickAction', val);
  };
  const handleDoubleClickActionChange = (e) => {
    const val = e.target.value;
    setDoubleClickAction(val);
    broadcast('doubleClickAction', val);
  };
  const handleRightClickActionChange = (e) => {
    const val = e.target.value;
    setRightClickAction(val);
    broadcast('rightClickAction', val);
  };

  // Garantir gestos únicos entre clique, duplo e direito
  useEffect(() => {
    if (clickAction && doubleClickAction && clickAction === doubleClickAction) {
      setDoubleClickAction('');
      broadcast('doubleClickAction', '');
    }
  }, [clickAction, doubleClickAction]);

  useEffect(() => {
    if (clickAction && rightClickAction && clickAction === rightClickAction) {
      setRightClickAction('');
      broadcast('rightClickAction', '');
    }
  }, [clickAction, rightClickAction]);

  // Click Assist
  const handleToggleClickAssist = (e) => {
    setClickAssist(e.target.checked);
    broadcast('clickAssist', e.target.checked);
  };
  const handleClickTimeoutChange = (e) => {
    const val = e.target.value === '' ? '' : Number(e.target.value);
    setClickTimeout(val);
    setClickTimeoutError(!(val >= 100 && val <= 10000));
  };
  const handleClickRadiusChange = (e) => {
    const val = e.target.value === '' ? '' : Number(e.target.value);
    setClickRadius(val);
    setClickRadiusError(!(val >= 30 && val <= 500));
  };
  useEffect(() => {
    const t = setTimeout(() => {
      broadcast('clickTimeout', (clickTimeout >= 100 && clickTimeout <= 10000) ? clickTimeout : 1000);
    }, 500);
    return () => clearTimeout(t);
  }, [clickTimeout]);
  useEffect(() => {
    const t = setTimeout(() => {
      broadcast('clickRadius', (clickRadius >= 30 && clickRadius <= 500) ? clickRadius : 0);
    }, 500);
    return () => clearTimeout(t);
  }, [clickRadius]);

  // Dwell Click
  const handleToggleDwellClick = (e) => {
    setDwellClick(e.target.checked);
    broadcast('dwellClick', e.target.checked);
  };
  const handleDwellTimeChange = (e) => {
    const val = e.target.value === '' ? '' : Number(e.target.value);
    setDwellTime(val);
    setDwellTimeError(!(val >= 300 && val <= 5000));
  };
  const handleDwellAreaChange = (e) => {
    const val = e.target.value === '' ? '' : Number(e.target.value);
    setDwellArea(val);
    setDwellAreaError(!(val >= 3 && val <= 100));
  };
  useEffect(() => {
    const t = setTimeout(() => {
      broadcast('dwellTime', (dwellTime >= 300 && dwellTime <= 5000) ? dwellTime : 3000);
    }, 500);
    return () => clearTimeout(t);
  }, [dwellTime]);
  useEffect(() => {
    const t = setTimeout(() => {
      broadcast('dwellArea', (dwellArea >= 3 && dwellArea <= 100) ? dwellArea : 0);
    }, 500);
    return () => clearTimeout(t);
  }, [dwellArea]);

  async function handleStop() {
    await chrome.runtime.sendMessage({ cmd: 'STOP_TRACKING' });
    onStop();
    window.close();
  }

  return (
    <>
      <h2>Rastreamento Ativo</h2>
      <p>O cursor personalizado está ativo nas suas páginas web.</p>

      <section className="settings">
        <h3 className="settings-heading">Configurações</h3>

        {/* Estilo do cursor */}
        <div className="setting-block">
          <div className="setting-label">Estilo do Cursor</div>
          <div className="setting-description">Escolha o tipo de cursor que deseja usar.</div>
          <div className="cursor-style-toggle" role="group" aria-label="Estilo do cursor" data-active={cursorSprite}>
            <span className="cursor-style-thumb" aria-hidden="true" />
            <button type="button"
              className={`cursor-style-option ${cursorSprite === 'arrow' ? 'is-active' : ''}`}
              aria-pressed={cursorSprite === 'arrow'}
              onClick={() => handleCursorSpriteChange('arrow')}
            >Ponteiro</button>
            <button type="button"
              className={`cursor-style-option ${cursorSprite === 'disc' ? 'is-active' : ''}`}
              aria-pressed={cursorSprite === 'disc'}
              onClick={() => handleCursorSpriteChange('disc')}
            >Disco</button>
          </div>
        </div>

        {/* Suavização */}
        <div className="setting-block">
          <div className="setting-label">
            Filtro de Suavização <span className="factor-value">({factor.toFixed(2)})</span>
          </div>
          <div className="setting-description">Valores menores respondem mais rápido. Valores maiores são mais suaves.</div>
          <input type="range" min="0.5" max="0.99" step="0.01" value={factor} onChange={handleSlider} className="slider" />
        </div>

        {/* Gesto de clique */}
        <div className="setting-block">
          <div className="setting-label">Gesto de Clique</div>
          <div className="setting-description">{clickActionDescriptions[clickAction] || clickActionDescriptions['']}</div>
          <select value={clickAction} onChange={handleClickActionChange} className="dropdown">
            <option value="">Nenhum</option>
            {gestureOptions
              .filter(o => o.value !== doubleClickAction && o.value !== rightClickAction)
              .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Gesto de clique duplo */}
        <div className="setting-block">
          <div className="setting-label">Gesto de Clique Duplo</div>
          <div className="setting-description">{doubleClickActionDescriptions[doubleClickAction] || doubleClickActionDescriptions['']}</div>
          <select value={doubleClickAction} onChange={handleDoubleClickActionChange} className="dropdown">
            <option value="">Nenhum</option>
            {gestureOptions
              .filter(o => o.value !== clickAction && o.value !== rightClickAction)
              .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Gesto de clique direito */}
        <div className="setting-block">
          <div className="setting-label">Gesto de Clique Direito</div>
          <div className="setting-description">{rightClickActionDescriptions[rightClickAction] || rightClickActionDescriptions['']}</div>
          <select value={rightClickAction} onChange={handleRightClickActionChange} className="dropdown">
            <option value="">Nenhum</option>
            {gestureOptions
              .filter(o => o.value !== clickAction && o.value !== doubleClickAction)
              .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Click Assist */}
        <div className="setting-block toggle-setting">
          <span className="setting-toggle-label">Ativar Assistência de Clique</span>
          <label className="switch-label switch-right">
            <input type="checkbox" checked={clickAssist} onChange={handleToggleClickAssist} />
            <span className="switch-slider"></span>
          </label>
        </div>

        {clickAssist && (
          <div className="toggle-settings-group animate-in">
            <div className="toggle-setting-block">
              <label className={`toggle-sub-setting-label ${clickTimeoutError ? 'error-label' : ''}`}>
                Tempo Limite (ms)
              </label>
              <input type="number" min="100" max="10000" step="100"
                value={clickTimeout} onChange={handleClickTimeoutChange}
                className={`number-input slim-input ${clickTimeoutError ? 'input-error' : ''}`}
              />
            </div>
            <div className="toggle-sub-setting-description">Tempo de expiração do bloqueio do cursor.</div>
            {clickTimeoutError && <div className="validation-message">Valor deve ser entre 100 e 10000 ms.</div>}

            <div className="toggle-setting-block">
              <label className={`toggle-sub-setting-label ${clickRadiusError ? 'error-label' : ''}`}>
                Raio (px)
              </label>
              <input type="number" min="30" max="500" step="10"
                value={clickRadius} onChange={handleClickRadiusChange}
                className={`number-input slim-input ${clickRadiusError ? 'input-error' : ''}`}
              />
            </div>
            <div className="toggle-sub-setting-description">Raio de movimento para manter o bloqueio.</div>
            {clickRadiusError && <div className="validation-message">Valor deve ser entre 30 e 500 px.</div>}
          </div>
        )}

        {/* Dwell Click */}
        <div className="setting-block toggle-setting">
          <span className="setting-toggle-label">Ativar Clique por Pausa</span>
          <label className="switch-label switch-right">
            <input type="checkbox" checked={dwellClick} onChange={handleToggleDwellClick} />
            <span className="switch-slider"></span>
          </label>
        </div>

        {dwellClick && (
          <div className="toggle-settings-group animate-in">
            <div className="toggle-setting-block">
              <label className={`toggle-sub-setting-label ${dwellTimeError ? 'error-label' : ''}`}>
                Tempo de Pausa (ms)
              </label>
              <input type="number" min="300" max="5000" step="100"
                value={dwellTime} onChange={handleDwellTimeChange}
                className={`number-input slim-input ${dwellTimeError ? 'input-error' : ''}`}
              />
            </div>
            <div className="toggle-sub-setting-description">Tempo parado antes de clicar.</div>
            {dwellTimeError && <div className="validation-message">Valor deve ser entre 300 e 5000 ms.</div>}

            <div className="toggle-setting-block">
              <label className={`toggle-sub-setting-label ${dwellAreaError ? 'error-label' : ''}`}>
                Área de Pausa (px)
              </label>
              <input type="number" min="3" max="100" step="1"
                value={dwellArea} onChange={handleDwellAreaChange}
                className={`number-input slim-input ${dwellAreaError ? 'input-error' : ''}`}
              />
            </div>
            <div className="toggle-sub-setting-description">Movimento permitido durante a pausa.</div>
            {dwellAreaError && <div className="validation-message">Valor deve ser entre 3 e 100 px.</div>}
          </div>
        )}

      </section>

      <button onClick={handleStop} className="stop-button">Parar Rastreamento</button>
    </>
  );
}

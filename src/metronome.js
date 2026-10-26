/* ============================================================
   METRÓNOMO
============================================================ */

const METRONOME_SUBDIVISION_QUARTER_NOTES =
  Object.freeze({
    white: 2,
    quarter: 1,
    eighth: 0.5
  });


const METRONOME_METER_INFO =
  Object.freeze({
    "2/4": {
      numerator: 2,
      denominator: 4,
      groups: [2]
    },
    "3/4": {
      numerator: 3,
      denominator: 4,
      groups: [3]
    },
    "4/4": {
      numerator: 4,
      denominator: 4,
      groups: [4]
    },
    "5/4": {
      numerator: 5,
      denominator: 4,
      groups: [5]
    },
    "6/8": {
      numerator: 6,
      denominator: 8,
      groups: [3, 3]
    },
    "7/8": {
      numerator: 7,
      denominator: 8,
      groups: [2, 2, 3]
    },
    "12/8": {
      numerator: 12,
      denominator: 8,
      groups: [3, 3, 3, 3]
    }
  });


function parseMetronomeMeter(meter) {

  const key =
    String(meter || "").trim();

  const info =
    METRONOME_METER_INFO[key];

  if (!info) {
    return null;
  }

  return {
    numerator:
      info.numerator,

    denominator:
      info.denominator
  };

}


function getMetronomeBarQuarterNotes(meter) {

  const parsed =
    parseMetronomeMeter(meter);

  if (!parsed) {
    return null;
  }

  return (
    parsed.numerator *
    (4 / parsed.denominator)
  );

}


function getMetronomeSubdivisionQuarterNotes(
  subdivision
) {

  return (
    METRONOME_SUBDIVISION_QUARTER_NOTES[
      subdivision
    ] ?? null
  );

}


function getMetronomeGroupStartPositions(
  meter
) {

  const info =
    METRONOME_METER_INFO[
      String(meter || "").trim()
    ];

  if (!info) {
    return [];
  }

  const unitQuarterNotes =
    4 / info.denominator;

  const positions = [];
  let position = 0;

  info.groups.forEach(groupSize => {

    positions.push(
      Number(
        position.toFixed(6)
      )
    );

    position +=
      groupSize *
      unitQuarterNotes;

  });

  return positions;

}


function getMetronomeMetricCellCount(meter) {

  const parsed =
    parseMetronomeMeter(meter);

  return parsed
    ? parsed.numerator
    : 0;

}


function getMetronomeCellQuarterNotes(
  meter
) {

  const parsed =
    parseMetronomeMeter(meter);

  return parsed
    ? 4 / parsed.denominator
    : null;

}


function getMetronomeCellIndex(
  meter,
  quarterPosition
) {

  const cellQuarterNotes =
    getMetronomeCellQuarterNotes(
      meter
    );

  const cellCount =
    getMetronomeMetricCellCount(
      meter
    );

  if (
    !cellQuarterNotes ||
    !cellCount ||
    !Number.isFinite(quarterPosition)
  ) {
    return null;
  }

  const indexFloat =
    quarterPosition /
    cellQuarterNotes;

  const index =
    Math.round(indexFloat);

  if (
    Math.abs(indexFloat - index) >
    0.00001
  ) {
    return null;
  }

  return (
    index >= 0 &&
    index < cellCount
      ? index
      : null
  );

}


function getMetronomeClickIntervalSeconds(
  bpm,
  subdivision
) {

  const numericBpm =
    Number(bpm);

  const subdivisionQuarterNotes =
    getMetronomeSubdivisionQuarterNotes(
      subdivision
    );

  if (
    !Number.isFinite(numericBpm) ||
    numericBpm <= 0 ||
    !subdivisionQuarterNotes
  ) {
    return null;
  }

  return (
    (60 / numericBpm) *
    subdivisionQuarterNotes
  );

}


function getMetronomeManualSyncAudioZeroTime(audioSeconds, elapsedContextSeconds, playbackRate = 1) {
  const audioTime = Number(audioSeconds);
  const elapsed = Number(elapsedContextSeconds);
  const rate = Number(playbackRate);
  if (
    !Number.isFinite(audioTime) ||
    audioTime < 0 ||
    !Number.isFinite(elapsed) ||
    elapsed < 0 ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return null;
  }
  // Audio currentTime is media time; convert elapsed AudioContext time by the media playback rate.
  return audioTime - elapsed * rate;
}


function getMetronomeNextSyncQuarterPosition(
  audioSeconds,
  bpm,
  subdivision,
  audioZeroTime = 0
) {
  const seconds = Number(audioSeconds);
  const numericBpm = Number(bpm);
  const zeroTime = Number(audioZeroTime);
  const clickQuarterNotes = getMetronomeSubdivisionQuarterNotes(subdivision);

  if (
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    !Number.isFinite(numericBpm) ||
    numericBpm <= 0 ||
    !Number.isFinite(zeroTime) ||
    !clickQuarterNotes
  ) {
    return null;
  }

  const currentQuarterPosition = (seconds - zeroTime) * numericBpm / 60;
  const nextPosition = Math.ceil(
    (currentQuarterPosition - METRONOME_POSITION_EPSILON) /
    clickQuarterNotes
  ) * clickQuarterNotes;
  return nextPosition === 0 ? 0 : nextPosition;
}


function getMetronomeBarQuarterPosition(
  quarterPosition,
  barQuarterNotes
) {
  const position = Number(quarterPosition);
  const bar = Number(barQuarterNotes);
  if (!Number.isFinite(position) || !Number.isFinite(bar) || bar <= 0) {
    return null;
  }

  return ((position % bar) + bar) % bar;
}


function getMetronomeSyncClickContextTime(
  currentAudioSeconds,
  targetQuarterPosition,
  bpm,
  playbackRate,
  contextTime,
  audioZeroTime = 0
) {
  const audioSeconds = Number(currentAudioSeconds);
  const quarterPosition = Number(targetQuarterPosition);
  const numericBpm = Number(bpm);
  const rate = Number(playbackRate);
  const audioContextTime = Number(contextTime);
  const zeroTime = Number(audioZeroTime);

  if (
    !Number.isFinite(audioSeconds) ||
    audioSeconds < 0 ||
    !Number.isFinite(quarterPosition) ||
    !Number.isFinite(numericBpm) ||
    numericBpm <= 0 ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    !Number.isFinite(audioContextTime) ||
    audioContextTime < 0 ||
    !Number.isFinite(zeroTime)
  ) {
    return null;
  }

  const targetAudioSeconds = zeroTime + quarterPosition * 60 / numericBpm;
  const delaySeconds = (targetAudioSeconds - audioSeconds) / rate;
  return audioContextTime + Math.max(
    METRONOME_INITIAL_CLICK_LEAD_SECONDS,
    delaySeconds
  );
}


let metronomeAudioContext =
  null;

let metronomeRunning =
  false;

let metronomeStarting =
  false;

let metronomeSchedulerTimer =
  null;

let metronomeAnimationFrame =
  null;

let metronomeNextClickTime =
  0;

// AudioContext time of the first click in the current standalone metronome run.
let metronomeGridOriginContextTime =
  null;

// Audio-file time corresponding to quarter-position zero for manual calibration.
let metronomeSyncAudioZeroTime =
  0;

let metronomeNextClickQuarterPosition =
  0;

let metronomeVisualEvents =
  [];

let metronomeTapTimes =
  [];

let metronomeTapResetTimer =
  null;

let metronomeSyncEnabled =
  false;

let metronomeSyncAudioPlayer =
  null;

let metronomeNextSyncQuarterPosition =
  null;

let metronomeStartRequestVersion =
  0;

const metronomeScheduledOscillators =
  new Set();


const METRONOME_SCHEDULE_AHEAD_SECONDS =
  0.12;

const METRONOME_INITIAL_CLICK_LEAD_SECONDS =
  0.01;

const METRONOME_SYNC_LATE_TOLERANCE_SECONDS =
  0.015;

const METRONOME_SCHEDULER_INTERVAL_MS =
  25;

const METRONOME_POSITION_EPSILON =
  0.00001;

const METRONOME_SYNC_CALIBRATION_STORAGE_PREFIX =
  "bandabase.metronome-sync-calibration.v1";


function getMetronomeSyncCalibrationStorageKey() {
  const songId = String(currentSong?.id || "");
  if (!songId) return null;

  // The manually captured offset belongs to the song. All original/split
  // tracks are expected to share the same timeline, so they reuse one value.
  return METRONOME_SYNC_CALIBRATION_STORAGE_PREFIX + ":" +
    encodeURIComponent(songId);
}


function getLegacyMetronomeSyncCalibrationStorageKey(player) {
  const songId = String(currentSong?.id || "");
  const attachmentId = String(
    player?.closest?.("[data-material-audio-id]")?.dataset.materialAudioId || ""
  );
  if (!songId || !attachmentId) return null;

  return METRONOME_SYNC_CALIBRATION_STORAGE_PREFIX + ":" +
    encodeURIComponent(songId) + ":" + encodeURIComponent(attachmentId);
}


function readMetronomeSyncCalibration(player, config) {
  const key = getMetronomeSyncCalibrationStorageKey();
  const legacyKey = getLegacyMetronomeSyncCalibrationStorageKey(player);
  if (!key) {
    return {
      audioZeroTime: 0,
      calibrated: false,
      status: "No se pudo identificar la canción para recuperar el ajuste."
    };
  }

  try {
    let raw = window.localStorage.getItem(key);
    let migratedLegacyValue = false;

    if (!raw && legacyKey) {
      raw = window.localStorage.getItem(legacyKey);
      migratedLegacyValue = Boolean(raw);
    }

    if (!raw) {
      return {
        audioZeroTime: 0,
        calibrated: false,
        status: "Todavía no hay un ajuste manual para esta canción. Podés calibrarlo con cualquiera de sus pistas."
      };
    }

    const calibration = JSON.parse(raw);
    const audioZeroTime = Number(calibration?.audioZeroTime);
    if (
      calibration?.version !== 1 ||
      !Number.isFinite(audioZeroTime) ||
      !Number.isFinite(Number(calibration?.bpm)) ||
      typeof calibration?.meter !== "string"
    ) {
      return {
        audioZeroTime: 0,
        calibrated: false,
        status: "El ajuste guardado no es válido. Volvé a calibrar."
      };
    }

    if (
      Number(calibration.bpm) !== Number(config.bpm) ||
      calibration.meter !== config.meter
    ) {
      return {
        audioZeroTime: 0,
        calibrated: false,
        status: "Cambió el BPM o la métrica desde la calibración. Volvé a guardar el ajuste."
      };
    }

    if (migratedLegacyValue) {
      saveMetronomeSyncCalibration(config, audioZeroTime);
    }

    return {
      audioZeroTime,
      calibrated: true,
      status: migratedLegacyValue
        ? "Se recuperó el ajuste anterior y ahora sirve para cualquier pista alineada de esta canción."
        : "Usando el ajuste manual de esta canción para la pista que esté reproduciéndose."
    };
  } catch {
    return {
      audioZeroTime: 0,
      calibrated: false,
      status: "El navegador no permitió leer el ajuste guardado."
    };
  }
}


function saveMetronomeSyncCalibration(config, audioZeroTime) {
  const key = getMetronomeSyncCalibrationStorageKey();
  if (!key || !Number.isFinite(audioZeroTime)) return false;

  try {
    window.localStorage.setItem(key, JSON.stringify({
      version: 1,
      audioZeroTime,
      bpm: Number(config.bpm),
      meter: config.meter,
      savedAt: Date.now()
    }));
    return true;
  } catch {
    return false;
  }
}

function updateMetronomeSyncCalibrationStatus(message) {
  const status = document.getElementById("metronomeSyncCalibrationStatus");
  if (status) status.textContent = message;
}


function captureManualMetronomeSyncCalibration() {
  if (metronomeSyncEnabled) {
    updateMetronomeSyncCalibrationStatus(
      "Desactivá «Sincronizar con audio» y volvé al metrónomo normal para guardar un ajuste manual."
    );
    return;
  }

  if (
    !metronomeRunning ||
    metronomeStarting ||
    !metronomeAudioContext ||
    metronomeAudioContext.state !== "running" ||
    !Number.isFinite(metronomeGridOriginContextTime)
  ) {
    updateMetronomeSyncCalibrationStatus(
      "Primero iniciá el metrónomo normal; después alinealo de oído con un audio."
    );
    return;
  }

  const config = readMetronomeFormValues();
  if (!isValidMetronomeConfig(config)) {
    updateMetronomeSyncCalibrationStatus("Completá un BPM y una métrica válidos antes de calibrar.");
    return;
  }

  const playingPlayers = getPlayingMaterialAudioPlayers();
  if (playingPlayers.length !== 1) {
    updateMetronomeSyncCalibrationStatus(
      "Reproducí exactamente un audio de Materiales para guardar el ajuste."
    );
    return;
  }

  const player = playingPlayers[0];
  const elapsedContextSeconds =
    metronomeAudioContext.currentTime - metronomeGridOriginContextTime;
  if (
    elapsedContextSeconds < 0 ||
    !Number.isFinite(player.currentTime) ||
    !Number.isFinite(player.playbackRate) ||
    player.playbackRate <= 0
  ) {
    updateMetronomeSyncCalibrationStatus("No se pudo leer la posición actual del audio y el metrónomo.");
    return;
  }

  // When both are manually aligned, this records the audio-time origin that
  // corresponds to the metronome's existing phase, regardless of when the
  // calibration button is pressed between beats.
  const audioZeroTime = getMetronomeManualSyncAudioZeroTime(
    player.currentTime,
    elapsedContextSeconds,
    player.playbackRate
  );
  if (
    audioZeroTime === null ||
    !saveMetronomeSyncCalibration(player, config, audioZeroTime)
  ) {
    updateMetronomeSyncCalibrationStatus(
      "No se pudo guardar el ajuste en este navegador. Revisá la configuración de almacenamiento."
    );
    return;
  }

  metronomeSyncAudioZeroTime = audioZeroTime;
  updateMetronomeSyncCalibrationStatus(
    "Ajuste guardado para este audio con " + config.bpm + " BPM y métrica " + config.meter +
    ". Activá «Sincronizar con audio» para reutilizarlo."
  );
}


function updateMetronomeVolumeDisplay() {
  const input = document.getElementById("metronomeVolumeInput");
  const output = document.getElementById("metronomeVolumeValue");
  if (!input || !output) return;
  output.value = input.value + "%";
  output.textContent = input.value + "%";
}


function metronomeElements() {

  return {
    playButton:
      document.getElementById(
        "metronomePlayBtn"
      ),

    bpmInput:
      document.getElementById(
        "metronomeBpmInput"
      ),

    meterInput:
      document.getElementById(
        "metronomeMeterInput"
      ),

    tapTempoButton:
      document.getElementById(
        "metronomeTapTempoBtn"
      ),

    tapTempoStatus:
      document.getElementById(
        "metronomeTapTempoStatus"
      ),

    subdivision:
      document.getElementById(
        "metronomeSubdivision"
      ),

    beats:
      document.getElementById(
        "metronomeBeats"
      )
  };

}


function readMetronomeFormValues() {

  const bpmInput =
    document.getElementById(
      "detailBpm"
    );

  const meterInput =
    document.getElementById(
      "detailMeter"
    );

  const bpm =
    bpmInput?.value
      ? Number(bpmInput.value)
      : null;

  const meter =
    meterInput?.value || "";

  const subdivision =
    document.getElementById(
      "metronomeSubdivision"
    )?.value ||
    "quarter";

  return {
    bpm,
    meter,
    subdivision
  };

}


function isValidMetronomeConfig(config) {

  return (
    Number.isFinite(config.bpm) &&
    config.bpm >= 1 &&
    config.bpm <= 400 &&
    Boolean(
      parseMetronomeMeter(
        config.meter
      )
    ) &&
    Boolean(
      getMetronomeSubdivisionQuarterNotes(
        config.subdivision
      )
    )
  );

}


function renderMetronomeMeter(meter) {

  const {
    beats
  } =
    metronomeElements();

  if (!beats) {
    return;
  }

  const cellCount =
    getMetronomeMetricCellCount(
      meter
    );

  const groupStarts =
    getMetronomeGroupStartPositions(
      meter
    );

  const cellQuarterNotes =
    getMetronomeCellQuarterNotes(
      meter
    );

  if (
    !cellCount ||
    !cellQuarterNotes
  ) {
    beats.innerHTML =
      '<span class="metronome-empty">Definí una métrica para mostrar el compás.</span>';

    return;
  }

  const groupStartIndices =
    new Set(
      groupStarts.map(
        position =>
          Math.round(
            position /
            cellQuarterNotes
          )
      )
    );

  beats.innerHTML =
    Array.from(
      { length: cellCount },
      (_, index) => {

        const isStrong =
          index === 0;

        const isGroupStart =
          groupStartIndices.has(
            index
          );

        return (
          '<span class="metronome-cell' +
          (
            isGroupStart
              ? ' metronome-cell-group-start'
              : ''
          ) +
          (
            isStrong
              ? ' metronome-cell-strong'
              : ''
          ) +
          '" data-metronome-cell="' +
          index +
          '">' +
          (index + 1) +
          "</span>"
        );

      }
    )
    .join("");

}


function updateMetronomeDisplay() {

  const {
    playButton,
    bpmInput,
    meterInput,
    subdivision
  } =
    metronomeElements();

  if (
    !playButton ||
    !bpmInput ||
    !meterInput ||
    !subdivision
  ) {
    return;
  }

  const config =
    readMetronomeFormValues();

  const detailBpm =
    document.getElementById("detailBpm");

  const detailMeter =
    document.getElementById("detailMeter");

  const currentBpmValue =
    detailBpm?.value || "";

  const currentMeterValue =
    detailMeter?.value || "";

  if (bpmInput.value !== currentBpmValue) {
    bpmInput.value = currentBpmValue;
  }

  if (meterInput.value !== currentMeterValue) {
    meterInput.value = currentMeterValue;
  }

  const valid =
    isValidMetronomeConfig(
      config
    );

  const syncInput = document.getElementById("metronomeSyncAudioInput");
  const syncEnabled = Boolean(syncInput?.checked);

  if (syncEnabled) {
    playButton.disabled = true;
    playButton.textContent = metronomeRunning
      ? "⏱ Siguiendo audio"
      : "⏱ Esperando audio";
    playButton.title = "Desactivá «Sincronizar con audio» para volver al modo independiente";
  } else {
    playButton.disabled =
      !valid &&
      !metronomeRunning;

    playButton.textContent =
      metronomeRunning
        ? "■ Detener"
        : "▶ Reproducir";

    playButton.title = "";
  }

  playButton.setAttribute(
    "aria-pressed",
    metronomeRunning
      ? "true"
      : "false"
  );

  renderMetronomeMeter(
    config.meter
  );

}


function clearMetronomeActiveCell() {

  const {
    beats
  } =
    metronomeElements();

  beats?.querySelectorAll(
    ".metronome-cell.active"
  )
    .forEach(
      cell => {
        cell.classList.remove(
          "active"
        );
      }
    );

}


function setMetronomeActiveCell(
  cellIndex
) {

  const {
    beats
  } =
    metronomeElements();

  if (!beats) {
    return;
  }

  beats.querySelectorAll(
    ".metronome-cell.active"
  )
    .forEach(
      cell => {
        cell.classList.remove(
          "active"
        );
      }
    );

  if (
    cellIndex === null ||
    cellIndex === undefined
  ) {
    return;
  }

  const cell =
    beats.querySelector(
      '[data-metronome-cell="' +
      cellIndex +
      '"]'
    );

  cell?.classList.add(
    "active"
  );

}


function getMetronomeAudioContext() {

  const AudioContextConstructor =
    window.AudioContext ||
    window.webkitAudioContext;

  if (
    !AudioContextConstructor
  ) {
    return null;
  }

  if (
    !metronomeAudioContext ||
    metronomeAudioContext.state ===
      "closed"
  ) {
    metronomeAudioContext =
      new AudioContextConstructor();
  }

  return metronomeAudioContext;

}


function scheduleMetronomeSound(
  time,
  accentLevel
) {

  if (!metronomeAudioContext) {
    return;
  }

  const oscillator =
    metronomeAudioContext.createOscillator();

  const gain =
    metronomeAudioContext.createGain();

  const frequency =
    accentLevel === "strong"
      ? 1000
      : accentLevel === "group"
        ? 720
        : 520;

  const baseVolume =
    accentLevel === "strong"
      ? 0.22
      : accentLevel === "group"
        ? 0.16
        : 0.11;

  const volumeInput =
    document.getElementById("metronomeVolumeInput");

  const volume =
    baseVolume * getAudioGainMultiplier(
      volumeInput?.value ?? 150
    );

  oscillator.type =
    "sine";

  oscillator.frequency.setValueAtTime(
    frequency,
    time
  );

  gain.gain.setValueAtTime(
    0.0001,
    time
  );

  gain.gain.exponentialRampToValueAtTime(
    volume,
    time + 0.004
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    time + 0.055
  );

  oscillator.connect(
    gain
  );

  gain.connect(
    metronomeAudioContext.destination
  );

  metronomeScheduledOscillators.add(oscillator);
  oscillator.addEventListener("ended", () => {
    metronomeScheduledOscillators.delete(oscillator);
  }, { once: true });

  oscillator.start(
    time
  );

  oscillator.stop(
    time + 0.06
  );

}


function cancelScheduledMetronomeSounds() {
  if (!metronomeAudioContext || metronomeAudioContext.state === "closed") {
    metronomeScheduledOscillators.clear();
    return;
  }

  const now = metronomeAudioContext.currentTime;
  for (const oscillator of metronomeScheduledOscillators) {
    try {
      oscillator.stop(now);
    } catch {
      // An oscillator may already have ended or have a stop time.
    }
  }
  metronomeScheduledOscillators.clear();
}


function getMetronomeAccentLevel(
  meter,
  quarterPosition
) {

  if (
    Math.abs(quarterPosition) <
    METRONOME_POSITION_EPSILON
  ) {
    return "strong";
  }

  const groupStarts =
    getMetronomeGroupStartPositions(
      meter
    );

  return groupStarts.some(
    position =>
      Math.abs(
        position -
        quarterPosition
      ) <
      METRONOME_POSITION_EPSILON
  )
    ? "group"
    : "normal";

}


function scheduleMetronomeClick(
  time,
  meter,
  quarterPosition
) {

  const accentLevel =
    getMetronomeAccentLevel(
      meter,
      quarterPosition
    );

  scheduleMetronomeSound(
    time,
    accentLevel
  );

  metronomeVisualEvents.push({
    time,
    cellIndex:
      getMetronomeCellIndex(
        meter,
        quarterPosition
      )
  });

}


function scheduleMetronomeAhead() {

  if (
    !metronomeRunning ||
    !metronomeAudioContext
  ) {
    return;
  }

  const config =
    readMetronomeFormValues();

  if (
    !isValidMetronomeConfig(
      config
    )
  ) {
    stopMetronome({ preserveSync: metronomeSyncEnabled });

    return;
  }

  const clickIntervalSeconds =
    getMetronomeClickIntervalSeconds(
      config.bpm,
      config.subdivision
    );

  const barQuarterNotes =
    getMetronomeBarQuarterNotes(
      config.meter
    );

  const clickQuarterNotes =
    getMetronomeSubdivisionQuarterNotes(
      config.subdivision
    );

  if (
    !clickIntervalSeconds ||
    !barQuarterNotes ||
    !clickQuarterNotes
  ) {
    stopMetronome({ preserveSync: metronomeSyncEnabled });

    return;
  }

  if (metronomeSyncEnabled) {
    const player = metronomeSyncAudioPlayer;
    if (
      !player ||
      player.paused ||
      player.ended ||
      player.isConnected === false ||
      !Number.isFinite(player.currentTime) ||
      !Number.isFinite(player.playbackRate) ||
      player.playbackRate <= 0
    ) {
      stopMetronome({ preserveSync: true });
      return;
    }

    const audioTime = player.currentTime;
    const playbackRate = player.playbackRate;

    if (
      !Number.isFinite(metronomeNextSyncQuarterPosition) ||
      metronomeSyncAudioZeroTime +
        metronomeNextSyncQuarterPosition * 60 / config.bpm <
        audioTime - METRONOME_SYNC_LATE_TOLERANCE_SECONDS
    ) {
      metronomeNextSyncQuarterPosition =
        getMetronomeNextSyncQuarterPosition(
          audioTime,
          config.bpm,
          config.subdivision,
          metronomeSyncAudioZeroTime
        );
    }

    if (!Number.isFinite(metronomeNextSyncQuarterPosition)) {
      stopMetronome({ preserveSync: true });
      return;
    }

    while (true) {
      const targetQuarterPosition = metronomeNextSyncQuarterPosition;
      const targetAudioTime =
        metronomeSyncAudioZeroTime + targetQuarterPosition * 60 / config.bpm;
      const audioDelay = (targetAudioTime - audioTime) / playbackRate;

      if (audioDelay > METRONOME_SCHEDULE_AHEAD_SECONDS) break;

      if (audioDelay < -METRONOME_SYNC_LATE_TOLERANCE_SECONDS) {
        metronomeNextSyncQuarterPosition += clickQuarterNotes;
        continue;
      }

      const contextTime = getMetronomeSyncClickContextTime(
        audioTime,
        targetQuarterPosition,
        config.bpm,
        playbackRate,
        metronomeAudioContext.currentTime,
        metronomeSyncAudioZeroTime
      );
      const barPosition = getMetronomeBarQuarterPosition(
        targetQuarterPosition,
        barQuarterNotes
      );

      if (contextTime !== null && barPosition !== null) {
        scheduleMetronomeClick(
          contextTime,
          config.meter,
          barPosition
        );
      }

      metronomeNextSyncQuarterPosition += clickQuarterNotes;
    }
  } else {
    const scheduleUntil =
      metronomeAudioContext.currentTime +
      METRONOME_SCHEDULE_AHEAD_SECONDS;

    while (
      metronomeNextClickTime <
      scheduleUntil
    ) {

      scheduleMetronomeClick(
        metronomeNextClickTime,
        config.meter,
        metronomeNextClickQuarterPosition
      );

      metronomeNextClickTime +=
        clickIntervalSeconds;

      metronomeNextClickQuarterPosition +=
        clickQuarterNotes;

      while (
        metronomeNextClickQuarterPosition >=
        barQuarterNotes -
          METRONOME_POSITION_EPSILON
      ) {

        metronomeNextClickQuarterPosition -=
          barQuarterNotes;

      }

    }
  }

  metronomeSchedulerTimer =
    window.setTimeout(
      scheduleMetronomeAhead,
      METRONOME_SCHEDULER_INTERVAL_MS
    );

}


function updateMetronomeAnimation() {

  if (
    !metronomeRunning ||
    !metronomeAudioContext
  ) {
    return;
  }

  const now =
    metronomeAudioContext.currentTime;

  while (
    metronomeVisualEvents.length &&
    metronomeVisualEvents[0].time <=
      now
  ) {

    const event =
      metronomeVisualEvents.shift();

    setMetronomeActiveCell(
      event.cellIndex
    );

  }

  metronomeAnimationFrame =
    window.requestAnimationFrame(
      updateMetronomeAnimation
    );

}


function stopMetronome(options = {}) {

  const preserveSync = options?.preserveSync === true;
  metronomeStartRequestVersion += 1;

  metronomeRunning =
    false;

  metronomeStarting =
    false;

  if (!preserveSync) {
    metronomeSyncEnabled = false;
    metronomeSyncAudioPlayer = null;
    metronomeNextSyncQuarterPosition = null;
    const syncInput = document.getElementById("metronomeSyncAudioInput");
    if (syncInput) syncInput.checked = false;
  }

  if (metronomeSchedulerTimer) {
    window.clearTimeout(
      metronomeSchedulerTimer
    );

    metronomeSchedulerTimer =
      null;
  }

  if (metronomeAnimationFrame) {
    window.cancelAnimationFrame(
      metronomeAnimationFrame
    );

    metronomeAnimationFrame =
      null;
  }

  metronomeVisualEvents =
    [];

  clearMetronomeActiveCell();
  cancelScheduledMetronomeSounds();
  metronomeNextSyncQuarterPosition = null;
  metronomeGridOriginContextTime = null;
  metronomeSyncAudioZeroTime = 0;

  if (
    metronomeAudioContext &&
    metronomeAudioContext.state !==
      "closed" &&
    metronomeAudioContext.state !==
      "suspended" &&
    !metronomeSyncEnabled
  ) {
    void metronomeAudioContext.suspend();
  }

  updateMetronomeDisplay();

}


async function startMetronome(syncPlayer = null) {

  if (metronomeSyncEnabled) {
    syncPlayer = syncPlayer || metronomeSyncAudioPlayer;
    if (!syncPlayer || syncPlayer.paused || syncPlayer.ended) {
      updateMetronomeDisplay();
      return;
    }
    metronomeSyncAudioPlayer = syncPlayer;
  }

  if (
    metronomeStarting ||
    metronomeRunning
  ) {
    return;
  }

  const startRequestVersion = ++metronomeStartRequestVersion;

  const config =
    readMetronomeFormValues();

  if (
    !isValidMetronomeConfig(
      config
    )
  ) {

    showNotice(
      "Ingresá un BPM válido y seleccioná una métrica para usar el metrónomo.",
      "error"
    );

    updateMetronomeDisplay();

    return;

  }

  const context =
    getMetronomeAudioContext();

  if (!context) {

    showNotice(
      "Este navegador no permite usar el audio necesario para el metrónomo.",
      "error"
    );

    return;

  }

  metronomeStarting =
    true;

  try {

    await context.resume();

    if (startRequestVersion !== metronomeStartRequestVersion) return;
    if (
      metronomeSyncEnabled &&
      (
        !syncPlayer ||
        metronomeSyncAudioPlayer !== syncPlayer ||
        syncPlayer.paused ||
        syncPlayer.ended
      )
    ) {
      return;
    }

    metronomeRunning =
      true;

    metronomeVisualEvents =
      [];

    metronomeNextClickTime =
      context.currentTime +
      METRONOME_INITIAL_CLICK_LEAD_SECONDS;

    metronomeGridOriginContextTime = metronomeSyncEnabled
      ? null
      : metronomeNextClickTime;

    const syncCalibration = metronomeSyncEnabled
      ? readMetronomeSyncCalibration(syncPlayer, config)
      : null;
    metronomeSyncAudioZeroTime = syncCalibration?.audioZeroTime ?? 0;
    if (syncCalibration) {
      updateMetronomeSyncCalibrationStatus(syncCalibration.status);
    }

    metronomeNextClickQuarterPosition =
      0;

    metronomeNextSyncQuarterPosition = metronomeSyncEnabled
      ? getMetronomeNextSyncQuarterPosition(
          syncPlayer.currentTime,
          config.bpm,
          config.subdivision,
          metronomeSyncAudioZeroTime
        )
      : null;

    updateMetronomeDisplay();

    scheduleMetronomeAhead();

    metronomeAnimationFrame =
      window.requestAnimationFrame(
        updateMetronomeAnimation
      );

  } catch (error) {

    if (startRequestVersion === metronomeStartRequestVersion) {
      console.error(error);
      showNotice(
        "No se pudo iniciar el audio del metrónomo.",
        "error"
      );
    }

  } finally {

    if (startRequestVersion === metronomeStartRequestVersion) {
      metronomeStarting = false;
      updateMetronomeDisplay();
    }

  }

}


function restartMetronomeFromForm() {

  if (metronomeSyncEnabled) {
    const player = metronomeSyncAudioPlayer;
    const config = readMetronomeFormValues();
    if (!isValidMetronomeConfig(config)) {
      stopMetronome({ preserveSync: true });
      return;
    }

    if (!metronomeRunning) {
      updateMetronomeDisplay();
      if (player && !player.paused && !player.ended) {
        void startMetronome(player);
      }
      return;
    }

    stopMetronome({ preserveSync: true });
    if (player && !player.paused && !player.ended) {
      metronomeSyncAudioPlayer = player;
      void startMetronome(player);
    }
    return;
  }

  if (!metronomeRunning) {
    updateMetronomeDisplay();
    return;
  }

  const config =
    readMetronomeFormValues();

  if (
    !isValidMetronomeConfig(
      config
    )
  ) {
    stopMetronome();
    return;
  }

  metronomeVisualEvents =
    [];

  clearMetronomeActiveCell();

  metronomeNextClickTime =
    (
      metronomeAudioContext?.currentTime ||
      0
    ) + METRONOME_INITIAL_CLICK_LEAD_SECONDS;

  metronomeGridOriginContextTime = metronomeNextClickTime;
  metronomeNextClickQuarterPosition =
    0;

  updateMetronomeDisplay();

}


function getPlayingMaterialAudioPlayers() {
  return Array.from(
    document.querySelectorAll("#materialsList audio[data-material-audio]")
  ).filter(player =>
    !player.paused &&
    !player.ended &&
    Number.isFinite(player.currentTime)
  );
}


function handleMetronomeSyncAudioEvent(event) {
  if (!metronomeSyncEnabled) return;

  const player = event.target;
  if (!player?.matches?.("#materialsList audio[data-material-audio]")) return;

  if (event.type === "play") {
    const otherPlayingPlayers = getPlayingMaterialAudioPlayers().filter(
      candidate => candidate !== player
    );

    if (otherPlayingPlayers.length) {
      if (metronomeRunning || metronomeStarting) {
        stopMetronome({ preserveSync: true });
      }
      metronomeSyncAudioPlayer = null;
      showNotice(
        "Para sincronizar el metrónomo, dejá un solo audio reproduciéndose. Pausá los demás.",
        "info"
      );
      updateMetronomeDisplay();
      return;
    }

    if (metronomeSyncAudioPlayer !== player) {
      if (metronomeRunning || metronomeStarting) {
        stopMetronome({ preserveSync: true });
      }
      metronomeSyncAudioPlayer = player;
    }
    void startMetronome(player);
    return;
  }

  if (
    (event.type === "pause" || event.type === "ended") &&
    metronomeSyncAudioPlayer === null
  ) {
    const playingPlayers = getPlayingMaterialAudioPlayers();
    if (playingPlayers.length === 1) {
      metronomeSyncAudioPlayer = playingPlayers[0];
      void startMetronome(playingPlayers[0]);
    }
    return;
  }

  if (player !== metronomeSyncAudioPlayer) return;

  if (event.type === "seeking") {
    stopMetronome({ preserveSync: true });
    return;
  }

  if (event.type === "seeked" || event.type === "ratechange") {
    if (!player.paused && !player.ended) {
      stopMetronome({ preserveSync: true });
      metronomeSyncAudioPlayer = player;
      void startMetronome(player);
    }
    return;
  }

  if (event.type === "pause" || event.type === "ended") {
    const otherPlayers = getPlayingMaterialAudioPlayers().filter(
      candidate => candidate !== player
    );

    stopMetronome({ preserveSync: true });

    if (otherPlayers.length === 1) {
      metronomeSyncAudioPlayer = otherPlayers[0];
      void startMetronome(otherPlayers[0]);
    } else if (otherPlayers.length > 1) {
      metronomeSyncAudioPlayer = null;
      showNotice(
        "Hay varios audios reproduciéndose. Pausá los demás para mantener la sincronización del metrónomo.",
        "info"
      );
    }
  }
}


function bindMetronomeControls() {

  const {
    playButton,
    bpmInput,
    meterInput,
    tapTempoButton
  } =
    metronomeElements();

  if (!playButton) {
    return;
  }

  const syncInput = document.getElementById("metronomeSyncAudioInput");
  const calibrationButton = document.getElementById("metronomeSyncCalibrateBtn");
  calibrationButton?.addEventListener("click", captureManualMetronomeSyncCalibration);

  syncInput?.addEventListener("change", () => {
    metronomeSyncEnabled = syncInput.checked;

    if (!metronomeSyncEnabled) {
      metronomeSyncAudioPlayer = null;
      stopMetronome({ preserveSync: true });
      updateMetronomeDisplay();
      return;
    }

    const context = getMetronomeAudioContext();
    if (context?.state === "suspended") {
      void context.resume().catch(() => {});
    }

    if (metronomeRunning || metronomeStarting) {
      stopMetronome({ preserveSync: true });
    }

    const playingPlayers = getPlayingMaterialAudioPlayers();
    if (playingPlayers.length === 1) {
      metronomeSyncAudioPlayer = playingPlayers[0];
      void startMetronome(playingPlayers[0]);
    } else {
      metronomeSyncAudioPlayer = null;
      metronomeNextSyncQuarterPosition = null;
      if (playingPlayers.length > 1) {
        showNotice(
          "Hay varios audios reproduciéndose. Pausá los demás y volvé a activar la sincronización.",
          "info"
        );
      }
      updateMetronomeDisplay();
    }
  });

  ["play", "pause", "ended", "seeking", "seeked", "ratechange"].forEach(type => {
    document.addEventListener(type, handleMetronomeSyncAudioEvent, true);
  });

  playButton.addEventListener(
    "click",
    function() {

      if (metronomeRunning) {
        stopMetronome();
      } else {
        void startMetronome();
      }

    }
  );


  [
    {
      id: "detailBpm",
      event: "input"
    },
    {
      id: "detailMeter",
      event: "change"
    }
  ]
    .forEach(
      ({
        id,
        event
      }) => {

        const input =
          document.getElementById(id);

        input?.addEventListener(
          event,
          function() {

            updateMetronomeDisplay();

            window.clearTimeout(
              input.__metronomeSyncTimer
            );

            input.__metronomeSyncTimer =
              window.setTimeout(
                restartMetronomeFromForm,
                180
              );

          }
        );

      }
    );


  bpmInput?.addEventListener(
    "input",
    function() {

      const detailBpm =
        document.getElementById("detailBpm");

      if (
        detailBpm &&
        detailBpm.value !== bpmInput.value
      ) {
        detailBpm.value =
          bpmInput.value;

        detailBpm.dispatchEvent(
          new Event("input", {
            bubbles: true
          })
        );

      } else {
        updateMetronomeDisplay();
      }

    }
  );


  meterInput?.addEventListener(
    "change",
    function() {

      const detailMeter =
        document.getElementById("detailMeter");

      if (
        detailMeter &&
        detailMeter.value !== meterInput.value
      ) {
        detailMeter.value =
          meterInput.value;

        detailMeter.dispatchEvent(
          new Event("change", {
            bubbles: true
          })
        );

      } else {
        updateMetronomeDisplay();
      }

    }
  );


  tapTempoButton?.addEventListener(
    "click",
    tapMetronomeTempo
  );

  const volumeInput =
    document.getElementById("metronomeVolumeInput");

  volumeInput?.addEventListener("input", updateMetronomeVolumeDisplay);
  updateMetronomeVolumeDisplay();


  document.getElementById(
    "metronomeSubdivision"
  )?.addEventListener(
    "change",
    function() {

      restartMetronomeFromForm();

    }
  );

  updateMetronomeDisplay();

}


function tapMetronomeTempo() {

  const {
    tapTempoStatus
  } =
    metronomeElements();

  const now =
    Date.now();

  const lastTap =
    metronomeTapTimes[
      metronomeTapTimes.length - 1
    ];

  if (
    lastTap &&
    now - lastTap > 2500
  ) {
    metronomeTapTimes = [];
  }

  const previousTap =
    metronomeTapTimes[
      metronomeTapTimes.length - 1
    ];

  if (
    previousTap &&
    now - previousTap < 150
  ) {
    if (tapTempoStatus) {
      tapTempoStatus.textContent =
        "Toque demasiado rápido";
    }

    return;
  }

  metronomeTapTimes.push(now);

  if (metronomeTapTimes.length > 5) {
    metronomeTapTimes.shift();
  }

  if (metronomeTapTimes.length < 2) {

    if (tapTempoStatus) {
      tapTempoStatus.textContent =
        "Tocá otra vez al pulso";
    }

  } else {

    const intervals =
      metronomeTapTimes
        .slice(1)
        .map(
          (tap, index) =>
            tap -
            metronomeTapTimes[index]
        )
        .filter(
          interval =>
            interval >= 150 &&
            interval <= 2500
        )
        .sort(
          (a, b) =>
            a - b
        );

    if (intervals.length) {

      const middle =
        Math.floor(
          intervals.length / 2
        );

      const medianInterval =
        intervals.length % 2
          ? intervals[middle]
          : (
              intervals[middle - 1] +
              intervals[middle]
            ) / 2;

      const bpm =
        Math.round(
          60000 / medianInterval
        );

      if (bpm >= 1 && bpm <= 400) {

        const detailBpm =
          document.getElementById("detailBpm");

        if (detailBpm) {
          detailBpm.value =
            String(bpm);

          detailBpm.dispatchEvent(
            new Event("input", {
              bubbles: true
            })
          );
        }

        if (tapTempoStatus) {
          tapTempoStatus.textContent =
            `${bpm} BPM · seguí tocando para ajustar`;
        }

      } else if (tapTempoStatus) {

        tapTempoStatus.textContent =
          "Pulso fuera del rango de BPM";

      }

    }

  }

  window.clearTimeout(
    metronomeTapResetTimer
  );

  metronomeTapResetTimer =
    window.setTimeout(
      function() {

        metronomeTapTimes = [];

        if (tapTempoStatus) {
          tapTempoStatus.textContent =
            "Tocá al pulso";
        }

        metronomeTapResetTimer =
          null;

      },
      2500
    );

}

function syncMetronomeFromSongForm() {

  updateMetronomeDisplay();

}


if (
  typeof document !== "undefined"
) {
  bindMetronomeControls();

  window.bandabaseStopMetronome =
    stopMetronome;

  window.bandabaseSyncMetronome =
    syncMetronomeFromSongForm;
}

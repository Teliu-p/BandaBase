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

let metronomeNextClickQuarterPosition =
  0;

let metronomeVisualEvents =
  [];


const METRONOME_SCHEDULE_AHEAD_SECONDS =
  0.12;

const METRONOME_SCHEDULER_INTERVAL_MS =
  25;

const METRONOME_POSITION_EPSILON =
  0.00001;


function metronomeElements() {

  return {
    playButton:
      document.getElementById(
        "metronomePlayBtn"
      ),

    bpmValue:
      document.getElementById(
        "metronomeBpmValue"
      ),

    meterValue:
      document.getElementById(
        "metronomeMeterValue"
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
    bpmValue,
    meterValue,
    subdivision
  } =
    metronomeElements();

  if (
    !playButton ||
    !bpmValue ||
    !meterValue ||
    !subdivision
  ) {
    return;
  }

  const config =
    readMetronomeFormValues();

  bpmValue.textContent =
    Number.isFinite(config.bpm)
      ? String(config.bpm)
      : "—";

  meterValue.textContent =
    config.meter ||
    "—";

  const valid =
    isValidMetronomeConfig(
      config
    );

  playButton.disabled =
    !valid &&
    !metronomeRunning;

  playButton.textContent =
    metronomeRunning
      ? "■ Detener"
      : "▶ Reproducir";

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

  const volume =
    accentLevel === "strong"
      ? 0.16
      : accentLevel === "group"
        ? 0.11
        : 0.075;

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

  oscillator.start(
    time
  );

  oscillator.stop(
    time + 0.06
  );

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
    stopMetronome();

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
    stopMetronome();

    return;
  }

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


function stopMetronome() {

  metronomeRunning =
    false;

  metronomeStarting =
    false;

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

  if (
    metronomeAudioContext &&
    metronomeAudioContext.state !==
      "closed" &&
    metronomeAudioContext.state !==
      "suspended"
  ) {
    void metronomeAudioContext.suspend();
  }

  updateMetronomeDisplay();

}


async function startMetronome() {

  if (
    metronomeStarting ||
    metronomeRunning
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

    metronomeRunning =
      true;

    metronomeVisualEvents =
      [];

    metronomeNextClickTime =
      context.currentTime +
      0.05;

    metronomeNextClickQuarterPosition =
      0;

    updateMetronomeDisplay();

    scheduleMetronomeAhead();

    metronomeAnimationFrame =
      window.requestAnimationFrame(
        updateMetronomeAnimation
      );

  } catch (error) {

    console.error(
      error
    );

    showNotice(
      "No se pudo iniciar el audio del metrónomo.",
      "error"
    );

  } finally {

    metronomeStarting =
      false;

  }

}


function restartMetronomeFromForm() {

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
    ) + 0.05;

  metronomeNextClickQuarterPosition =
    0;

  updateMetronomeDisplay();

}


function bindMetronomeControls() {

  const {
    playButton
  } =
    metronomeElements();

  if (!playButton) {
    return;
  }

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
    "detailBpm",
    "detailMeter"
  ]
    .forEach(
      id => {

        const input =
          document.getElementById(
            id
          );

        input?.addEventListener(
          "input",
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

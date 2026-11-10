/* ============================================================
   SUPABASE
============================================================ */

const SUPABASE_URL =
  "https://evuwcikuxptrgzdzejov.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_ERDp1BzfCrzk3QBQf6rKSQ_FGogulnV";

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );


/* ============================================================
   COLORES
============================================================ */

const SONG_COLORS = [
  {
    name: "Rojo",
    value: "#E74C3C"
  },
  {
    name: "Naranja",
    value: "#E67E22"
  },
  {
    name: "Amarillo",
    value: "#F1C40F"
  },
  {
    name: "Verde lima",
    value: "#8BC34A"
  },
  {
    name: "Verde",
    value: "#2ECC71"
  },
  {
    name: "Turquesa",
    value: "#1ABC9C"
  },
  {
    name: "Cian",
    value: "#00A8CC"
  },
  {
    name: "Azul",
    value: "#3498DB"
  },
  {
    name: "Azul oscuro",
    value: "#2E5AAC"
  },
  {
    name: "Violeta",
    value: "#8E44AD"
  },
  {
    name: "Magenta",
    value: "#C445B5"
  },
  {
    name: "Rosa",
    value: "#E85D8E"
  },
  {
    name: "Marrón",
    value: "#8D6E63"
  },
  {
    name: "Gris",
    value: "#7F8C8D"
  }
];


/* ============================================================
   ESTADO
============================================================ */

let currentUser = null;
let currentBand = null;
let currentProfile = null;
let currentBandRole = "member";

let allSongs = [];
let songSingersMap = {};
let allBandMembers = [];
let bandMemberProfilesMap = {};

let currentSong = null;
let currentMaterials = [];
let currentOriginalComparisonMaterial = null;
let navigationInitialized = false;
let initializedUserId = null;
let initializingUserId = null;

let currentBandLists = [];
let bandListItemsMap = {};
let bandListManagersMap = {};
let currentBandList = null;


let editingBandListId = null;

let selectedNewSongColor = null;
let selectedDetailSongColor = null;
let editingSongListsSongId = null;



/* ============================================================
   UTILIDADES
============================================================ */

function escapeHtml(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function showNotice(
  message,
  type = ""
) {

  notice.innerHTML = `
    <div class="notice ${type}">
      ${escapeHtml(message)}
    </div>
  `;

  setTimeout(() => {

    notice.innerHTML = "";

  }, 3500);
}



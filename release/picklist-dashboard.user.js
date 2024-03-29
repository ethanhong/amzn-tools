// ==UserScript==
// @name         Picklist Dashboard
// @namespace    https://github.com/ethanhong/amzn-tools/tree/main/release
// @version      1.6.2
// @description  Picklist dashboard
// @author       Pei
// @match        https://aftlite-na.amazon.com/picklist_group
// @match        https://aftlite-na.amazon.com/picklist_group/index
// @match        https://aftlite-na.amazon.com/picklist_group?selected_tab*
// @match        https://aftlite-na.amazon.com/picklist_group/index?selected_tab*
// @match        https://aftlite-portal.amazon.com/picklist_group
// @match        https://aftlite-portal.amazon.com/picklist_group/index
// @match        https://aftlite-portal.amazon.com/picklist_group?selected_tab=*
// @match        https://aftlite-portal.amazon.com/picklist_group/index?selected_tab=*
// @updateURL    https://ethanhong.github.io/amzn-tools/release/picklist-dashboard.user.js
// @downloadURL  https://ethanhong.github.io/amzn-tools/release/picklist-dashboard.user.js
// @supportURL   https://github.com/ethanhong/amzn-tools/issues
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// @require      https://www.kryogenix.org/code/browser/sorttable/sorttable.js
// @require      https://ethanhong.github.io/amzn-tools/release/authenticator.js
// @grant        GM_addStyle
// ==/UserScript==

/* global React */
/* global ReactDOM */

const e = React.createElement
const isPortal = window.location.hostname === 'aftlite-portal.amazon.com'
const URL = {}
const SELECTOR = {}

if (isPortal) {
  URL.VIEW_PICKLIST = '/picklist/view_picklist?picklist_id='
  URL.PACK_BY_PICKLIST = '/picklist/pack_by_picklist?picklist_id='
  URL.PICKLIST_GROUP = '/picklist_group/display_picklist_group?picklist_group_id='
  URL.USER_TRACKING = '/labor_tracking/lookup_history?user_name='
  SELECTOR.OLD_TABLE = '#main-content > table'
  SELECTOR.VIEW_PICKLIST_CPT = '#main-content > div:nth-child(4) > div.a-span4'
  SELECTOR.PICKLIST_GROUP_TR = '#main-content > table > tbody > tr:not(tr:first-child)'
  SELECTOR.GROUP_LIST_TR = 'tbody > tr:not(tr:first-child)'
} else {
  URL.VIEW_PICKLIST = '/wms/view_picklist?picklist_id='
  URL.PACK_BY_PICKLIST = '/wms/pack_by_picklist?picklist_id='
  URL.PICKLIST_GROUP = '/picklist_group/display_picklist_group?picklist_group_id='
  URL.USER_TRACKING = '/labor_tracking/lookup_history?user_name='
  SELECTOR.OLD_TABLE = '#picklist_group_list'
  SELECTOR.VIEW_PICKLIST_CPT = 'body > table > tbody > tr:nth-child(4) > td:nth-child(2)'
  SELECTOR.PICKLIST_GROUP_TR = '#picklist_group > tbody > tr'
  SELECTOR.GROUP_LIST_TR = 'tbody > tr'
}

const ACTIONS = {
  ADD_INFO: 'add-info',
  ADD_PULLTIME: 'add-pulltime',
}

// eslint-disable-next-line camelcase, no-undef
const SCRIPT_INFO = GM_info

showDashboard()

// eslint-disable-next-line no-unused-vars
async function showDashboard() {
  // eslint-disable-next-line no-undef
  const isCheckValid = await isValid(SCRIPT_INFO)
  if (!isCheckValid) return

  const oldTbl = document.querySelector(SELECTOR.OLD_TABLE)
  // mount app
  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('id', 'root')
  oldTbl.before(rootDiv)
  ReactDOM.createRoot(rootDiv).render(e(App, { oldTbl }))
}

function reducer(groups, action) {
  switch (action.type) {
    case ACTIONS.ADD_INFO:
      return groups.map((group) => {
        if (group.gID === action.payload.gID) {
          return {
            ...group,
            remainUnit: action.payload.info[0],
            remainBin: action.payload.info[1],
            skipped: action.payload.info[2],
          }
        }
        return group
      })

    case ACTIONS.ADD_PULLTIME:
      return groups.map((group) => {
        if (group.gID === action.payload.gID) {
          return {
            ...group,
            pullTime: [...group.pullTime, action.payload.pullTime],
          }
        }
        return group
      })

    default:
      return groups
  }
}

function App({ oldTbl }) {
  const switchRef = React.useRef()
  const dashboardRef = React.useRef()

  const bags = React.useMemo(() => getBags(oldTbl), [])
  const [groups, dispatch] = React.useReducer(reducer, createGroups(bags))

  React.useEffect(() => {
    const abortController = new AbortController()
    const { signal } = abortController
    bags.map((bag) =>
      getBagPullTime(bag.pID, signal).then((pullTime) =>
        dispatch({ type: ACTIONS.ADD_PULLTIME, payload: { gID: bag.gID, pullTime } })
      )
    )
    groups.map((group) =>
      getGroupInfo(group.gID, signal).then((info) =>
        dispatch({ type: ACTIONS.ADD_INFO, payload: { gID: group.gID, info } })
      )
    )
    return () => abortController.abort()
  }, [])

  const backSwitch = e('form', { id: 'switch-form' }, [
    e('input', {
      type: 'checkbox',
      ref: switchRef,
      onChange: () => {
        dashboardRef.current.style.display = switchRef.current.checked ? 'none' : 'block'
      },
    }),
    ' Hide dashboard',
  ])
  const dashboard = e('div', { ref: dashboardRef }, e(Dashboard, { groups }))
  return e(React.Fragment, null, [backSwitch, dashboard])
}

async function getBagPullTime(pID, signal) {
  try {
    const res = await fetch(`${URL.VIEW_PICKLIST}${pID}`, { signal })
    const txt = await res.text()
    const html = new DOMParser().parseFromString(txt, 'text/html')
    const content = html.querySelector(SELECTOR.VIEW_PICKLIST_CPT).textContent
    const timeStr = content
      .split(/\s+/)
      .slice(0, -2)
      .join(' ')
      .replace('am', ' am')
      .replace('pm', ' pm')
      .replace('between ', '')
    return new Date(timeStr)
  } catch (err) {
    console.log(`${err} \n picklistId: ${pID}`)
    return null
  }
}

async function getGroupInfo(gID, signal) {
  const trSelector = SELECTOR.PICKLIST_GROUP_TR
  try {
    const res = await fetch(`${URL.PICKLIST_GROUP}${gID}`, { signal })
    const txt = await res.text()
    const html = new DOMParser().parseFromString(txt, 'text/html')
    const rows = [...html.querySelectorAll(trSelector)]
    const data = rows.map((row) => [...row.children]).map((row) => row.map((cell) => cell.innerText.trim()))
    const transposedData = data[0].map((col, i) => data.map((row) => row[i])) // transpose
    const [, pIDArr, locationArr, qtyArr, packedArr, shortArr, skipArr] = transposedData
    const remainUnit = sum(qtyArr) - sum(packedArr)
    const remainBin = new Set(locationArr.filter((_, i) => !packedArr[i])).size
    const skipBags = await getSkipBags(pIDArr, shortArr, skipArr, signal)
    return [remainUnit, remainBin, skipBags]
  } catch (err) {
    console.log(`${err} \n groupId: ${gID}`)
    return ['-', '-', []]
  }
}

async function getSkipBags(pIDArr, shortArr, skipArr, signal) {
  const skipId = Array.from(new Set(pIDArr.filter((_, i) => Boolean(shortArr[i] + skipArr[i]))))
  const skipBags = []
  for (let i = 0; i < skipId.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const pullTime = await getBagPullTime(skipId[i], signal)
    skipBags.push([skipId[i], pullTime])
  }
  return skipBags
}

function getBags(tbl) {
  const bags = [...tbl.querySelectorAll(SELECTOR.GROUP_LIST_TR)]
    .map((x) => [...x.querySelectorAll('td')])
    .map((x) => ({
      gID: x[0].textContent.trim(),
      picker: x[1].textContent.trim().split(' ')[0],
      completedAt: x[3].textContent
        ? x[3].textContent.replace('AM', ' AM').replace('PM', ' PM').replace(' on', '').trim()
        : 'In progress',
      pID: x[4].firstElementChild.textContent.trim(),
      zone: x[6].textContent.trim(),
    }))

  return window.location.search.toLowerCase().includes('completed')
    ? bags
        .filter((bag) => minDiff(new Date(), new Date(bag.completedAt)) < 30)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    : bags
}

function createGroups(bags) {
  const groups = []
  for (let i = 0; i < bags.length; i += 1) {
    const bag = bags[i]
    const isCreatedGroup = groups.find((group) => group.gID === bag.gID)
    if (!isCreatedGroup) {
      groups.push({
        gID: bag.gID,
        zone: bag.zone,
        picker: bag.picker,
        completedAt: bag.completedAt,
        remainUnit: null,
        remainBin: null,
        pullTime: [],
        skipped: [],
      })
    }
  }
  return groups
}

function Dashboard({ groups }) {
  return e('table', { className: 'sortable', id: 'dashboard' }, [
    e('thead', null, e(Header)),
    e(
      'tbody',
      null,
      groups.map((group) => e(GroupRow, { group, key: group.gId }))
    ),
    // e('tbody', null, [...groups.map((group) => e(GroupRow, { group, key: group.gId })), e(TotalRow, { groups })]),
    e('tfoot', null, e(TotalRow, { groups })),
  ])
}

function Header() {
  const titles = [
    'Picklist Group',
    'Zone',
    'Picker',
    'Completed at',
    'Remaining Units',
    'Remaining Bins',
    '< 1 Hour',
    '< 2 Hours',
    '< 3 Hours',
    '> 3 Hours',
    'Skipped',
  ]
  return e(
    'tr',
    null,
    titles.map((x) => e('th', { style: null, key: x }, x))
  )
}

function GroupRow({ group }) {
  const now = new Date()
  const minFromNow = group.pullTime.map((pt) => minDiff(pt, now))

  const skipBags = group.skipped.map((bag) =>
    e(
      'div',
      { key: bag[0] },
      e('a', { className: 'skipped', href: `${URL.PACK_BY_PICKLIST}${bag[0]}` }, `0${bag[1].getHours()}:00`.slice(-5))
    )
  )

  const cells = [
    e('td', { style: { display: 'none' } }), // avoid affect from picklist-inspector
    e('td', { style: { display: 'none' } }), // avoid affect from picklist-inspector
    e('td', { style: { display: 'none' } }), // avoid affect from picklist-inspector
    e('td', { style: { display: 'none' } }), // avoid affect from picklist-inspector
    e('td', { style: { display: 'none' } }), // avoid affect from picklist-inspector
    e('td', null, e('a', { href: `${URL.PICKLIST_GROUP}${group.gID}` }, group.gID)),
    e('td', null, group.zone),
    e('td', null, e('a', { href: `${URL.USER_TRACKING}${group.picker}` }, group.picker)),
    e('td', null, group.completedAt),
    e('td', null, group.remainUnit),
    e('td', null, group.remainBin),
    e('td', null, minFromNow.filter((x) => x < 60).length),
    e('td', null, minFromNow.filter((x) => x >= 60 && x < 120).length),
    e('td', null, minFromNow.filter((x) => x >= 120 && x < 180).length),
    e('td', null, minFromNow.filter((x) => x >= 180).length),
    e('td', { className: skipBags.length ? 'skipped' : '' }, skipBags),
  ]
  return e('tr', null, cells)
}

function TotalRow({ groups }) {
  const now = new Date()
  const timeDiff = groups.map((group) => group.pullTime.map((pt) => minDiff(pt, now)))
  const cells = Array(11).fill(e('td', null, ''))
  cells[5] = e('td', null, 'Subtotal')
  cells[6] = e('td', null, sum(timeDiff.map((row) => row.filter((x) => x < 60).length)))
  cells[7] = e('td', null, sum(timeDiff.map((row) => row.filter((x) => x >= 60 && x < 120).length)))
  cells[8] = e('td', null, sum(timeDiff.map((row) => row.filter((x) => x >= 120 && x < 180).length)))
  cells[9] = e('td', null, sum(timeDiff.map((row) => row.filter((x) => x >= 180).length)))
  return e('tr', { id: 'total-row' }, cells)
}

function minDiff(dt1, dt2) {
  return Math.floor((dt1 - dt2) / 1000 / 60)
}

function sum(arr) {
  let result = 0
  for (let i = 0; i < arr.length; i += 1) {
    const int = parseInt(arr[i], 10) || 0
    result += int
  }
  return result
}

// eslint-disable-next-line no-undef
GM_addStyle(`
  #root {
    margin: 0 !important;
    margin-bottom: 1rem !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }

  #dashboard, 
  #dashboard th,
  #dashboard td {
    border-collapse: collapse;
    border: 1px solid #e8e8e8;
    text-align: center;
    vertical-align: middle;
    padding: 0.5rem;
  }

  #dashboard th {
    background-color: #f0f0f0 !important;
  }

  #dashboard tr {
    background-color: #fffffc !important;
  }

  #dashboard tr:hover {
    background-color: #f8f8f8 !important;
  }

  #dashboard td.skipped {
    background-color: pink !important;
  }

  #dashboard a.skipped {
    background-color: pink !important;
    color: red !important;
  }

  tr#total-row {
    font-weight: bold;
  }

  /* Sortable tables */
  table.sortable thead {
    font-weight: bold;
    cursor: default;
  }
`)

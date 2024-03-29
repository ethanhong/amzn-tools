// ==UserScript==
// @name         Find Bags [como]
// @namespace    https://github.com/ethanhong/amzn-tools/tree/main/release
// @version      2.1.1
// @description  Return stage locations for given scannable codes
// @author       Pei
// @match        https://como-operations-dashboard-iad.iad.proxy.amazon.com/store/*
// @updateURL    https://ethanhong.github.io/amzn-tools/release/find-bag-como.user.js
// @downloadURL  https://ethanhong.github.io/amzn-tools/release/find-bag-como.user.js
// @supportURL   https://github.com/ethanhong/amzn-tools/issues
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// ==/UserScript==

/* global React */
/* global ReactDOM */
/* eslint-disable prefer-destructuring */

const e = React.createElement

startBagFinder()

function getCSS() {
  const style = `
  #search-bar {
    margin-bottom: 1rem;
    margin-left: 1rem;
  }
  #search_input {
    margin-right: 0.2rem;
  }
  #search_input, #find_btn {
    line-height: 2.5rem;
  }
  `
  return style
}

async function comoPackages() {
  const STORE_ID = window.location.href.split('store/')[1].split('/')[0]
  const response = await fetch(
    `https://como-operations-dashboard-iad.iad.proxy.amazon.com/api/store/${STORE_ID}/packages`
  )
  const data = await response.json()
  return data
}

function App() {
  const [searchTerm, setSearchTerm] = React.useState('')
  const searchInputRef = React.useRef(null)

  const handleOnClick = async () => {
    const [scannableMissing, ...scannableToFind] = searchTerm.trim().split(',')
    const bags = await comoPackages()
    const message = bags
      .filter((bag) => scannableToFind.includes(bag.scannableId))
      .sort((a, b) => a.lastKnownLocation.localeCompare(b.lastKnownLocation))
      .reduce(
        (str, bag) => `${str}${bag.lastKnownLocation} ------ ${bag.scannableId.slice(-4)}\n`,
        `Possible locations for scannable id ending in ${scannableMissing.slice(-4)}:\n`
      )
    // eslint-disable-next-line no-alert
    alert(message)
    searchInputRef.current.value = ''
  }

  React.useEffect(() => {
    searchInputRef.current.focus()
  }, [])

  const searchBar = e('form', null, [
    e('input', {
      id: 'search_input',
      type: 'search',
      placeholder: 'Find bags ...',
      size: '100',
      value: searchTerm,
      ref: searchInputRef,
      onChange: (evt) => setSearchTerm(evt.target.value),
    }),
    e('input', {
      id: 'find_btn',
      type: 'button',
      value: 'Find',
      onClick: handleOnClick,
    }),
  ])
  return e('div', { id: 'search-bar' }, searchBar)
}

// eslint-disable-next-line no-unused-vars
async function startBagFinder() {
  // add stylesheet
  const styleSheet = document.createElement('style')
  styleSheet.innerText = getCSS()
  document.head.appendChild(styleSheet)

  // mount app
  const rootDiv = document.createElement('div')
  const navBar = document.querySelector('nav')
  navBar.append(rootDiv)
  ReactDOM.createRoot(rootDiv).render(e(App))
}

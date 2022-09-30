/* global React */
/* global ReactDOM */
/* global QRCode */

const e = React.createElement;
const SearchContext = React.createContext();
const QRCodeContext = React.createContext();

// eslint-disable-next-line no-unused-vars
function ultimateOrderView() {
  if (!isVerifiedUser(getLogin())) {
    return;
  }

  const rootDiv = document.createElement('div');
  rootDiv.setAttribute('id', 'root');
  document.body.insertBefore(rootDiv, document.querySelector('#orders_form'));
  ReactDOM.render(e(App), document.querySelector('#root'));

  addCSS();
}

function getBags() {
  const bags = [];

  const picklistsTableRows = [...document.querySelectorAll('#picklists_table > tbody > tr')];
  picklistsTableRows.shift(); // drop header row

  const rowContents = picklistsTableRows.map(row => row.textContent.trim().split(/\s+/));
  const packUrls = picklistsTableRows.map(row => row.querySelector('td:last-child > a'));

  for (let i = 0; i < rowContents.length; i += 1) {
    const bag = {};
    bag.picker = {};
    [bag.id, bag.zone, bag.status, bag.spoo, bag.pickerLogin] = rowContents[i];
    bag.pickerUrl = `/labor_tracking/lookup_history?user_name=${bag.pickerLogin}`;
    bag.packUrl = packUrls[i].href;
    bag.code = getBagCode(bag.spoo);
    bag.totalItem = getBagTotalItem(bag.spoo);
    bags.push(bag);
  }
  return bags;
}

function isValidCode(str) {
  return Boolean(str.match(/[a-z,A-z,0-9]{20}/));
}

function getBagCode(spoo) {
  if (!isValidCode(spoo)) {
    return '-';
  }
  const spooLink = [...document.querySelectorAll('a')].find(node => node.textContent === spoo);
  const contents = spooLink.parentNode.childNodes[5].textContent.trim().split(/\s+/);
  return contents[1] || '-';
}

function getBagTotalItem(spoo) {
  if (!isValidCode(spoo)) {
    return '-';
  }
  const spooLink = [...document.querySelectorAll('a')].find(node => node.textContent === spoo);
  const contents = spooLink.parentNode.childNodes[7].textContent.trim().split(/\s+/);
  return contents[0] || '-';
}

function BagRow({ bag, completionTime }) {
  const { searchTerm } = React.useContext(SearchContext);
  const { setQRCodeContent } = React.useContext(QRCodeContext);

  const handleOnClick = event => {
    const value = event.target.textContent;
    if (isValidCode(value)) {
      setQRCodeContent(value);
    }
  };

  const pickerLik = e('a', { href: bag.pickerUrl }, `${bag.pickerLogin}`);
  const packLink = e('a', { href: bag.packUrl }, 'Pack');
  const rowCells = [
    e('td', null, bag.id),
    e('td', null, bag.zone),
    e('td', null, bag.status),
    e('td', null, completionTime),
    e('td', { onClick: handleOnClick }, bag.code),
    e('td', { onClick: handleOnClick }, bag.spoo),
    e('td', null, pickerLik),
    e('td', null, `${bag.totalItem} items`),
    e('td', null, packLink),
  ];

  const keyword = searchTerm.toUpperCase();
  const bagCode = bag.code.toUpperCase();
  const bagSpoo = bag.spoo.toUpperCase();
  const trAttr =
    keyword && (containsKeyword(bagCode, keyword) || containsKeyword(bagSpoo, keyword))
      ? { className: 'search-target' }
      : null;

  return e('tr', trAttr, rowCells);
}

function containsKeyword(str, keyword) {
  return str.indexOf(keyword) > -1;
}

function BagTable() {
  const headers = [
    'ID',
    'Zone',
    'Status',
    'Completion Time',
    'Tracking Code',
    'Spoo',
    'Picker',
    'Total Items',
    '',
  ];
  const headerRow = e(
    'tr',
    null,
    headers.map(header => e('th', null, `${header}`))
  );

  const bags = getBags();
  const [completionTimeArray, setCompletionTimeArray] = React.useState(
    Array(bags.length).fill('-')
  );

  React.useEffect(() => {
    for (let i = 0; i < bags.length; i += 1) {
      const bag = bags[i];
      const fetchURL = '/wms/view_picklist_history?picklist_id=';

      fetch(`${fetchURL}${encodeURIComponent(bag.id)}`)
        .then(res => res.text())
        .then(page => extractCompletionTime(page))
        .then(time =>
          setCompletionTimeArray(prevArray => [
            ...prevArray.slice(0, i),
            time,
            ...prevArray.slice(i + 1),
          ])
        );
    }
  }, []);

  const bagRows = bags.map((bag, i) => e(BagRow, { bag, completionTime: completionTimeArray[i] }));
  return e('table', { id: 'bag-table' }, [e('thead', null, headerRow), e('tbody', null, bagRows)]);
}

function extractCompletionTime(page) {
  const completionTimeSelector = 'body > table:nth-child(6) > tbody > tr:nth-child(6)';
  const timeRe = /\d{1,2}:\d{1,2}/;
  const html = new DOMParser().parseFromString(page, 'text/html');
  const completionTime = html.querySelector(completionTimeSelector).textContent.match(timeRe);
  return completionTime || '-';
}

function makeQRCode(str) {
  return new QRCode(document.querySelector('#qrcode-container'), {
    text: str,
    width: 160,
    height: 160,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });
}

function QRCodeArea() {
  const { qrcodeContent } = React.useContext(QRCodeContext);

  const qrcodeContainer = e('div', { id: 'qrcode-container' });
  const qrcodeText = e('div', { id: 'qrcode-text' }, qrcodeContent);

  return e('div', { id: 'qrcode-area' }, [qrcodeContainer, qrcodeText]);
}

function SearchBar() {
  const { searchTerm, setsearchTerm } = React.useContext(SearchContext);
  const handleOnChange = evt => setsearchTerm(evt.target.value);

  return e('form', null, [
    e('input', {
      type: 'text',
      placeholder: 'Search by tracking-code or spoo',
      size: '30',
      value: searchTerm,
      onChange: handleOnChange,
      style: { lineHeight: '1.5rem' },
    }),
    /*     e('input', {
      type: 'checkbox',
      checked: isStockOnly,
      onChange: this.handleInStockChange,
    }),
    'Only show related packages', */
  ]);
}

let qrcodeMaker = null;
function UltimateTable() {
  const [qrcodeContent, setQRCodeContent] = React.useState('');

  React.useEffect(() => {
    if (!qrcodeContent) return;
    if (qrcodeMaker === null) {
      qrcodeMaker = makeQRCode(qrcodeContent);
    } else {
      qrcodeMaker.makeCode(qrcodeContent);
    }
  }, [qrcodeContent]);

  const bagTable = e(BagTable);
  const qrcodeArea = e(QRCodeArea);
  const ultimateTableContainer = e('div', { id: 'ultimateTable-container' }, [
    bagTable,
    qrcodeArea,
  ]);

  return e(
    QRCodeContext.Provider,
    {
      value: { qrcodeContent, setQRCodeContent },
    },
    ultimateTableContainer
  );
}

function App() {
  const [searchTerm, setsearchTerm] = React.useState('');

  return e(SearchContext.Provider, { value: { searchTerm, setsearchTerm } }, [
    e(SearchBar),
    e(UltimateTable),
  ]);
}

function getLogin() {
  return document.getElementsByTagName('span')[0].innerHTML.match(/\(([^)]+)\)/)[1];
}

function isVerifiedUser(user) {
  console.log(`hello, ${user}`);
  return true;
}

function addCSS() {
  const styles = `
    :root,
    body,
    html {
      box-sizing: border-box;
    }
    
    div,
    table,
    thead,
    tbody,
    tr,
    th,
    td,
    a {
      margin: 0;
      padding: 0;
      border: 0;
      outline: none;
      font-size: 100%;
      vertical-align: baseline;
      background: transparent;
    }
    
    #ultimateTable-container {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      margin: 0.5rem 0 1rem 0;
    }
    
    #bag-table {
      border-collapse: collapse;
      font-family: monospace;
      font-size: 1rem;
      color: #101010;
      margin-right: 1rem;
      margin-bottom: 0.5rem;
      border: 1px solid #888;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    }
    
    #bag-table th {
      background-color: #e8e8e8;
      padding: 0.6rem;
      text-align: center;
      vertical-align: middle;
    }
    
    #bag-table td {
      padding: 0.8rem 1rem;
      text-align: center;
      vertical-align: middle;
    }
    
    #bag-table tbody tr:nth-child(even) {
      background-color: #e8e8e8;
    }
    
    #bag-table tbody tr:hover {
      background-color: #ccc;
    }
    
    #qrcode-text {
      width: 100%;
      font-size: 0.8rem;
      line-height: 1.2rem;
      text-align: center;
      font-family: monospace;
    }
    
    tr.search-target {
      border: 2px solid firebrick;
    }
  `;

  const styleSheet = document.createElement('style');
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
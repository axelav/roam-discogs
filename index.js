// create click handler for Discogs Sync button
if (window.discogsBtn) {
  document.removeEventListener(discogsBtn.handleClick)
} else {
  window.discogsBtn = {}
}

discogsBtn.handleClick = async (e) => {
  if (e.target.tagName === 'BUTTON') {
    const block = e.target.closest('.roam-block')

    if (!block) return

    const uid = block.id.substring(block.id.length - 9)
    const content = await window.roamAlphaAPI
      .q(`[:find (pull ?block [:block/string]) 
					:where [?block :block/uid "${uid}"]]`)[0][0].string

    if (!content) return

    const btnRegExp = /^(\{\{Discogs Search\}\})(.*)/
    const [_, btnText, query] = btnRegExp.exec(content)
    if (btnText === '{{Discogs Search}}') {
      const mainText = await addData(query, uid)

      window.roamAlphaAPI.updateBlock({
        block: {
          uid: uid,
          string: mainText,
        },
      })
    }
  }
}

document.addEventListener('click', discogsBtn.handleClick, false)

//place Discogs v1 api token here
const token = 'YOUR-TOKEN-HERE'

const handleResponse = async (res) => {
  if (!res.ok) {
    const text = await res.text()

    return Promise.reject(text)
  } else {
    return await res.json()
  }
}

const getSearchResults = async (query) => {
  const res = await fetch(
    `https://api.discogs.com/database/search?token=${token}&type=master&q=${query}`
  )

  return handleResponse(res)
}

const getMasterRelease = async (id) => {
  const res = await fetch(
    `https://api.discogs.com/masters/${id}?token=${token}`
  )

  return handleResponse(res)
}

const getMainRelease = async (id) => {
  const res = await fetch(
    `https://api.discogs.com/releases/${id}?token=${token}`
  )

  return handleResponse(res)
}

const writeTag = (str) => `#${str.toLowerCase()}`

//create new block and place data
const addRelease = (release, page_uid) => {
  const { artists, title, year, genres, styles, label } = release
  const tags = [...genres, ...styles]

  const artistStr = artists.map(({ name }) => name).join(artists.join)
  const mainText = `${artistStr}, __${title}__ ([[${year}]])`

  window.roamAlphaAPI.createBlock({
    location: { 'parent-uid': page_uid, order: 0 },
    block: { string: `rating:: {{Add Stars:SmartBlock:stars}}` },
  })

  window.roamAlphaAPI.createBlock({
    location: { 'parent-uid': page_uid, order: 1 },
    block: { string: `record label:: [[${label}]]` },
  })

  window.roamAlphaAPI.createBlock({
    location: { 'parent-uid': page_uid, order: 2 },
    block: { string: `tags:: ${tags.map(writeTag).join(' ')}` },
  })

  window.roamAlphaAPI.createBlock({
    location: { 'parent-uid': page_uid, order: 3 },
    block: { string: `url:: ${release.uri}` },
  })

  return mainText
}

const addData = async (query, uid) => {
  try {
    const searchResults = await getSearchResults(query)

    if (searchResults.results.length > 0) {
      const firstResult = searchResults.results[0]
      const masterRelease = await getMasterRelease(firstResult.master_id)
      const mainRelease = await getMainRelease(masterRelease.main_release)

      return addRelease(
        { ...masterRelease, label: mainRelease.labels[0].name },
        uid
      )
    } else {
      console.warn('No results!')
    }
  } catch (err) {
    console.error('Discogs Search Error: ', err)
  }
}

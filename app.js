if (!(process.env.GAE_SERVICE || process.env.GOOGLE_CLOUD_PROJECT))
  require('dotenv').config({ silent: true })
const axios = require('axios')
const app = require('express')()
const datastore = require('@google-cloud/datastore')()
app.enable('trust proxy')
axios.defaults.headers.common['X-Key'] = process.env.FORTNITE_STATS_KEY

const players = [
  "akhanubis",
  "changofanko",
  "elreme",
  "JoacoM24",
  "Jorninos94",
  "Juanso871",
  "ramanujans"
];

const sizes = [20, 6, 6, 6]
const headers = ['Player', 'K-D', 'K-D 1d', 'K-D 7d']

padded_cell = (text, column_i) => (text + ' '.repeat(sizes[column_i])).slice(0, sizes[column_i]) + '|'

table_header = () => headers.reduce((out, h, i) => out + padded_cell(h, i), '|')

format_date = d => {
  dd = d.getDate(),
  mm = d.getMonth() + 1,
  yyyy = d.getFullYear()
  if(dd < 10)
    dd = '0' + dd
  if(mm < 10)
    mm = '0' + mm
  return yyyy + mm + dd
}

today = () => format_date(new Date())

days_ago = ago => {
  let d = new Date()
  d.setDate(d.getDate() - ago)
  return format_date(d)
}

delta_to_table = (d_0, d_1, d_7) => {
  let table = table_header()
  for (let i = 0; i < d_0.length; i++)
    table += player_data_to_row(d_0[i], d_1[i], d_7[i])
  return '```' + table + '```'
}

player_data_to_row = (d0, d1, d7) => {
  let kd = d0.all.kills - d0.all.deaths,
      kd1d = d0.all.kills - d1.all.kills - d0.all.deaths + d1.all.deaths
      kd7d = d0.all.kills - d7.all.kills - d0.all.deaths + d7.all.deaths
  return "\n|" + padded_cell(d0.player, 0) + padded_cell(kd, 1) + padded_cell(kd1d, 2) + padded_cell(kd7d, 3)
}

sleep_between_requests = () => new Promise(resolve => setTimeout(resolve, 2000))

fetch_player_data = p => new Promise(resolve => axios.get(`https://fortnite.y3n.co/v2/player/${ p }`).then(r => resolve({ ...r.data.br.stats.pc, player: p })))

store_players_data = data => datastore.upsert({
    key: datastore.key(['Stats', today()]),
    data: { date: today(), stats: data }
  })

retrieve_old_data = ago => {
  let q = datastore.createQuery('Stats').filter('date', '=', days_ago(ago))
  return datastore.runQuery(q)
}

async function job(_, res) {
  res.status(200).end()
  let ps = [...players], data_0d = []
  while (ps.length) {
    p = ps.shift()
    console.log(`Fetching ${ p }...`)
    let p_data = await fetch_player_data(p)
    data_0d = data_0d.concat(p_data)
    await sleep_between_requests()
  }
  await store_players_data(data_0d)
  let old_results = await Promise.all([retrieve_old_data(1), retrieve_old_data(7)])
  data_1d = old_results[0][0][0].stats
  data_7d = old_results[1][0][0].stats
  axios.post(process.env.WEBHOOK, {
    content: delta_to_table(data_0d, data_1d, data_7d)
  }).then(() => console.log('Stats posted'))
}

app.get('/trigger_job', job)

app.get('/', () => {
  res.status(200).end()
  console.log("It's alive")
})

const PORT = process.env.PORT || 8080
app.listen(process.env.PORT || 8080, () => {
  console.log(`App listening on port ${PORT}`)
  console.log('Press Ctrl+C to quit.')
})
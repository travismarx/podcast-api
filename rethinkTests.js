const r = require('rethinkdbdash')({db: 'pulpmx_drupal'});
const fs = require('fs');

const files = fs.readdirSync('./drupal_json', 'utf8');
files.map(file => {
    const fileName = file.slice(0, -5);
    r.table(fileName).insert(r.http(`http://pulpmx.com/api/drupal_json/${file}`)).run()
})
    


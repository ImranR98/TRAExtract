// Dependencies
const fs = require('fs')
const https = require('https')
const { basename } = require('path')
const url = require('url')

// Constants
const baseURL = 'verify.tra.go.tz'

// Parse the raw text from the input file and return valid and invalid URLs
const parseRawTRAText = (data) => {
    const lines = data.split('\n').map(line => line.trim())
    const allLines = []
    lines.filter(line => (line.trim()).length > 0).forEach(line => {
        if (line.startsWith('http://' + baseURL) || line.startsWith('https://' + baseURL))
            allLines.push(line)
        else {
            allLines.push(`-${line}`)
        }
    })
    return allLines
}

// Grab the raw HTML from a URL
const getHTML = (urlStr) => {
    return new Promise((resolve, reject) => {
        const q = new url.URL(urlStr)
        const options = {
            path: q.pathname,
            host: q.hostname,
            port: q.port,
            timeout: 86400000
        }
        https.get(options, (resp) => {
            let data = ''
            resp.on('data', (chunk) => {
                data += chunk
            })
            resp.on('end', () => {
                resolve(data)
            })
        }).on("error", (err) => {
            reject(err)
        })
    })
}

// Extract required data from the raw HTML of the verify.tra.go.tz page
const extractTRAData = (rawhtml) => {
    lines = rawhtml.split('\n').map(str => str.trim()).filter(str => str.length > 0)
    const recNoIndex = lines.findIndex(str => str.includes('RECEIPT NO:'))
    const recDateIndex = lines.findIndex(str => str.includes('RECEIPT DATE:'))
    let totalIndex = lines.findIndex(str => str.includes('TOTAL INCL OF TAX:'))
    const vrnIndex = lines.findIndex(str => str.includes('VRN:'))
    const nameIndex = lines.findIndex(str => str.includes('<center><h4><b>'))
    if (recNoIndex < 0 || recDateIndex < 0 || totalIndex < 0 || ++totalIndex >= lines.length || vrnIndex < 0 || nameIndex < 0)
        throw `Failed to extract all data indices: recNoIndex is ${recNoIndex}, recDateIndex is ${recDateIndex}, totalIndex is ${totalIndex}, vrnIndex is ${vrnIndex}, and nameIndex is ${nameIndex}.`
    const recNo = lines[recNoIndex].split('</b>').pop().trim()
    const recDate = lines[recDateIndex].split('</b>').pop().trim()
    const total = lines[totalIndex].split('">').pop().trim().slice(0, -5).trim()
    const vrn = lines[vrnIndex].split('</b>').pop().trim()
    const name = lines[nameIndex].slice(15).slice(0, -18).trim()
    if (!recNo || !recDate || !total || !vrn || !name) throw `Failed to extract all data: recNo is ${recNo}, recDate is ${recDate}, total is ${total}, vrn is ${vrn}, and name is ${name}.`
    return { recNo, recDate, total, vrn, name }
}

const extract = async (file, folder) => {
    if (!fs.existsSync(file)) throw 'Provided input file path is invalid.'
    if (!fs.statSync(file).isFile()) throw 'Provided input file path does not point to a file.'
    if (!fs.existsSync(folder)) throw 'Provided output folder path is invalid.'
    if (!fs.statSync(folder).isDirectory()) throw 'Provided output folder path does not point to a folder.'

    // Parse the input file
    const allLines = parseRawTRAText(fs.readFileSync(file).toString())
    console.log(`Found ${allLines.length} lines, of which ${allLines.filter(line => !line.startsWith('-')).length} are valid '${baseURL}' URLs.`)

    // Attempt to extract data for each valid URL
    const results = []
    for (let i = 0; i < allLines.length; i++) {
        let url = allLines[i]
        try {
            if (url.startsWith('-')) {
                url = url.slice(1)
                throw 'Line is not a valid TRA receipt URL'
            }
            results.push({ url, data: extractTRAData(await getHTML(url)) })
            console.log(`${i + 1} of ${allLines.length}:\tExtracted data for '${url}'.`)
        } catch (err) {
            results.push({ url, data: typeof err === 'string' ? err : JSON.stringify(err) })
            console.error(`${i + 1} of ${allLines.length}:\tERROR: Failed to extract data for '${url}': ${typeof err === 'string' ? err : JSON.stringify(err, null, '\t')}.`)
        }
    }
    // Prepare and save results
    let errCount = 0
    let finalResults = []
    finalResults.push(`COMPANY,VRN,RECEIPT,DATE,TOTAL`)
    finalResults = finalResults.concat(results.map(result => {
        if (typeof result.data === 'string') {
            errCount++
            return `"ERROR: ${result.url}: ${result.data}",,,,`
        } else
            return `${result.data.name},${result.data.vrn},${result.data.recNo},${result.data.recDate},${result.data.total}`
    }))
    finalResults = finalResults.join('\n')
    const fileName = basename(file)
    if (finalResults.length > 0) {
        fs.writeFileSync(`${folder}/Results-${fileName}.csv`, finalResults)
        console.log(`Saved results into ${folder}/Results-${fileName}.csv`)
        if (errCount > 0) {
            console.log(`There were ${errCount} errors, so Results-${fileName}.csv will contain error messages on the appropriate row(s).`)
        }
    }
}

extract(process.argv[2], process.argv[3]).then(() => {
    process.exit(0)
}).catch(err => {
    console.log(err)
    process.exit(1)
})
module.exports.extract = (file, folder) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve('This\nIs\nA\nPlaceholder.')
        }, 5000)
    })
}

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
    const validURLs = [], invalidLines = []
    lines.forEach(line => {
        if (line.startsWith('http://' + baseURL) || line.startsWith('https://' + baseURL))
            validURLs.push(line)
        else
            invalidLines.push(line)
    })
    return { validURLs, invalidLines }
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

module.exports.extract = async (file, folder) => {
    let logs = ''
    const log = (data) => {
        console.log(data)
        logs += data + '\n'
    }

    if (!fs.existsSync(file)) throw 'Provided input file path is invalid.'
    if (!fs.statSync(file).isFile()) throw 'Provided input file path does not point to a file.'
    if (!fs.existsSync(folder)) throw 'Provided output folder path is invalid.'
    if (!fs.statSync(folder).isDirectory()) throw 'Provided output folder path does not point to a folder.'

    // Parse the input file
    const { validURLs, invalidLines } = parseRawTRAText(fs.readFileSync(file).toString())
    log(`Found ${validURLs.length} valid '${baseURL}' URLs${invalidLines.length > 0 ? ` and ${invalidLines.length} invalid lines` : ``}.`)

    // Attempt to extract data for each valid URL
    const results = []
    const errors = invalidLines.map(line => { return { url: line, error: 'Not a valid TRA receipt URL' } })
    for (let i = 0; i < validURLs.length; i++) {
        try {
            results.push({ url: validURLs[i], data: extractTRAData(await getHTML(validURLs[i])) })
            log(`${i + 1} of ${validURLs.length}:\tExtracted data for ${validURLs[i]} ...`)
        } catch (err) {
            if (typeof err === 'string') errors.push({ url: validURLs[i], error: err })
            else errors.push({ url: validURLs[i], error: err })
            console.error(`${i + 1} of ${validURLs.length}:\tFailed to extract data for ${validURLs[i]} ...`)
        }
    }

    // Prepare and save results and errors
    let finalResults = []
    finalResults.push(`COMPANY,VRN,RECEIPT,DATE,TOTAL`)
    finalResults = finalResults.concat(results.map(result => {
        return `${result.data.name},${result.data.vrn},${result.data.recNo},${result.data.recDate},${result.data.total}`
    }))
    finalResults = finalResults.join('\n')
    const finalErrors = errors.map(error => {
        return `Error for '${error.url}':\n${typeof error.error === 'string' ? error.error : JSON.stringify(error.error)}\n`
    }).join('\n')
    const fileName = basename(file)
    if (finalResults.length > 0) {
        fs.writeFileSync(`${folder}/Results-${fileName}.csv`, finalResults)
        log(`Saved ${results.length} valid results into ${folder}/Results-${fileName}.`)
    }
    if (finalErrors.length > 0) {
        fs.writeFileSync(`${folder}/Errors-${fileName}`, finalErrors)
        log(`Saved ${errors.length} error details into ${folder}/Errors-${fileName}.`)
    }

    return logs
}
const inputButton = document.getElementById('inputButton')
const inputDiv = document.getElementById('inputDiv')
const outputButton = document.getElementById('outputButton')
const outputDiv = document.getElementById('outputDiv')
const startButton = document.getElementById('startButton')
const logDiv = document.getElementById('logDiv')
const help = document.getElementById('help')

help.onclick = () => {
    window.api.send('toMain', { type: 'HELP', data: null })
}

inputButton.onclick = () => {
    window.api.send('toMain', { type: 'PICKINPUT', data: null })
}

outputButton.onclick = () => {
    window.api.send('toMain', { type: 'PICKOUTPUT', data: null })
}

startButton.onclick = () => {
    window.api.send('toMain', { type: 'START', data: { file: inputDiv.getAttribute('data-item'), folder: outputDiv.getAttribute('data-item') } })
}

const validate = () => {
    if (inputDiv.getAttribute('data-item') && outputDiv.getAttribute('data-item'))
        startButton.removeAttribute('disabled')
    else
        startButton.setAttribute('disabled', 'true')
}

window.onload = () => { validate() }

const now = () => {
    let now = new Date()
    let hours = now.getHours().toString()
    let minutes = now.getMinutes().toString()
    if (hours.length < 2) hours = '0' + hours
    if (minutes.length < 2) minutes = '0' + minutes
    return hours + ':' + minutes
}

window.api.receive('fromMain', (message) => {
    switch (message.type) {
        case 'SETINPUT':
            inputDiv.innerHTML = message.data ? message.data : 'Pick input file'
            inputDiv.setAttribute('data-item', message.data)
            validate()
            break;
        case 'SETOUTPUT':
            outputDiv.innerHTML = message.data ? message.data : 'Pick output folder '
            outputDiv.setAttribute('data-item', message.data)
            validate()
            break;
        case 'ENABLE':
            startButton.removeAttribute('disabled')
            inputButton.removeAttribute('disabled')
            outputButton.removeAttribute('disabled')
            help.removeAttribute('disabled')
            break;
        case 'DISABLE':
            startButton.setAttribute('disabled', 'true')
            inputButton.setAttribute('disabled', 'true')
            outputButton.setAttribute('disabled', 'true')
            help.setAttribute('disabled', 'true')
            break;
        case 'LOG':
            logDiv.innerHTML += now() + ':\n' + message.data + '\n\n'
            break;
        default:
            console.error('Unrecognized message.')
            console.error(message)
            break;
    }
})
const home = document.getElementById('home')
const trascan = document.getElementById('trascan')

home.onclick = () => {
    window.api.send('toMain', { type: 'HOME', data: null })
}

trascan.onclick = () => {
    window.api.send('toMain', { type: 'TRASCAN', data: null })
}
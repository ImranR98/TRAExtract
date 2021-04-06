# TRAExtract

Extract TRA receipt information from a list of URLs of the form 'https://verify.tra.go.tz/<RECEIPT_NUMBER>'

Use the TRAScan mobile app to scan receipt QR codes and generate the list of URLs.

> Made for Papa.



## Usage

This is a command line application that requires Node.js.

Run the app and provide the path to the input file, and the path to a directory in which to store output files like so:

```bash
node app.js <path to input file> <path to output folder>
```
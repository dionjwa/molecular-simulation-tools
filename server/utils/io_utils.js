const appRoot = require('app-root-path');
const crypto = require('crypto');
const fs = require('fs-extended');
const path = require('path');
const shortid = require('shortid');
const log = require('./log');

const ioUtils = {
  readJsonFile(source) {
    return new Promise((resolve, reject) => {
      fs.readFile(source, 'utf8', (err, contents) => {
        if (err) {
          return reject(err);
        }
        return resolve(JSON.parse(contents));
      });
    });
  },

  /**
   * Hash the contents of the given stream
   * @param readableStream {Stream}
   * @returns {Promise}
   */
  hashStream(readableStream) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha1');
      hash.setEncoding('hex');

      readableStream.on('end', () => {
        hash.end();
        resolve(hash.read());
      });
      readableStream.on('error', reject);

      readableStream.pipe(hash);
    });
  },

  /**
   * Synchronously hash a simple string
   * @param string {String}
   * @returns {String}
   */
  hashString(string) {
    return crypto.createHash('sha1').update(string).digest('hex');
  },

  /**
   * Given a readable stream, hash its contents and write it to the given
   * directory with its hash as its name
   * @param readableStream {Stream}
   * @param targetDir {String}
   * @returns {Promise}j
   */
  streamToHashFile(readableStream, targetDir) {
    // Write the input to a temp file
    return new Promise((resolve, reject) => {
      const filename = `tmp_${shortid.generate()}.pdb`;
      const saveTo = path.join(appRoot.toString(), 'public/tmp', filename);
      const writeableStream = fs.createWriteStream(saveTo);

      writeableStream.on('finish', (err) => {
        log.trace({ f: 'streamToHashFile', event: 'finish writing temp file' });
        if (err) {
          return reject(err);
        }

        return resolve(saveTo);
      });

      readableStream.pipe(writeableStream);
    }).then(tempFilepath =>
      // Hash the temp file
      ioUtils.hashStream(fs.createReadStream(tempFilepath)).then((hashed) => {
        const filename = `${hashed}.pdb`;
        const saveTo = path.join(appRoot.toString(), targetDir, filename);

        // Save to the final filepath if needed, with the hash as the filename
        return new Promise((resolve, reject) => {
          fs.exists(saveTo, (exists) => {
            if (exists) {
              return resolve();
            }

            const writeableStream = fs.createWriteStream(saveTo);
            writeableStream.on('finish', () => {
              log.trace({ f: 'streamToHashFile', event: 'finish writing file' });
              resolve();
            });
            writeableStream.on('error', reject);
            return fs.createReadStream(tempFilepath).pipe(writeableStream);
          });
        }).then(() =>
          // Finally, cleanup by deleting the temp file
          ioUtils.deleteFile(tempFilepath).then(() => filename)
        );
      })
    );
  },

  /**
   * Given a string of file contents, write the string to a file whose name is
   * a hash of its contents
   * @param string {String}
   * @param targetDir {String}
   * @returns {Promise}j
   */
  stringToHashFile(string, targetDir) {
    const hashed = ioUtils.hashString(string);
    const filename = `${hashed}.pdb`;
    const saveTo = path.join(appRoot.toString(), targetDir, filename);

    return new Promise((resolve, reject) => {
      fs.exists(saveTo, (exists) => {
        if (!exists) {
          return fs.writeFile(saveTo, string, (err) => {
            if (err) {
              return reject(err);
            }

            return resolve(filename);
          });
        }

        return resolve(filename);
      });
    });
  },

  /**
   * Delete the indicated file
   * @param filepath {String}
   * @returns {Promise} resolves with {String}
   */
  deleteFile(filepath) {
    return new Promise((resolve, reject) => {
      fs.unlink(filepath, (err) => {
        if (err) {
          return reject(err);
        }

        return resolve(filepath);
      });
    });
  },
};

module.exports = ioUtils;

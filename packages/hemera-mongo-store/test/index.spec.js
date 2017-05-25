'use strict'

const Hemera = require('./../../hemera')
const HemeraMongoStore = require('./../index')
const Nats = require('nats')
const Code = require('code')
const HemeraTestsuite = require('hemera-testsuite')
const EJSON = require('mongodb-extended-json')

const now = new Date()
const expect = Code.expect

function createExtendedData(mongodb) {
  const oid = new mongodb.ObjectID('58c6c65ed78c6a977a0041a8')
  return EJSON.serialize({
    date: now,
    objectId: oid,
    ref: mongodb.DBRef('test', oid),
  })
}

function testExtendedData(plugin, testCollection, id, done) {
  const ObjectID = plugin.mongodb.ObjectID
  const DBRef = plugin.mongodb.DBRef

  plugin.db.collection(testCollection).findOne({
    _id: new ObjectID(id)
  }, (err, doc) => {
    expect(err).to.be.null()
    expect(doc.date).to.be.a.date()
    expect(doc.objectId).to.be.an.instanceof(ObjectID)
    expect(doc.ref).to.be.an.instanceof(DBRef)
    done()
  })
}

describe('Hemera-mongo-store', function () {
  let PORT = 6243
  let noAuthUrl = 'nats://localhost:' + PORT
  const topic = 'mongo-store'
  const testCollection = 'test'
  let server
  let hemera
  let plugin

  before(function (done) {
    server = HemeraTestsuite.start_server(PORT, {}, () => {
      const nats = Nats.connect(noAuthUrl)
      hemera = new Hemera(nats, {
        logLevel: 'silent'
      })
      hemera.use(HemeraMongoStore, {
        mongo: {
          url: 'mongodb://localhost:27017/test'
        }
      })
      hemera.ready(() => {
        plugin = hemera.exposition['hemera-mongo-store']
        hemera.act({
          topic,
          cmd: 'dropCollection',
          collection: testCollection
        }, function (err, resp) {
          done()
        })
      })
    })
  })

  after(function (done) {
    hemera.close()
    server.kill()
    done()
  })

  it('create', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'peter'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()
      expect(resp._id).to.be.exists()

      done()
    })
  })

  it('create multiple documents', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: [
        { name: 'peter' }, { name: 'parker' }
      ]
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()
      expect(resp._ids).to.be.an.array().length(2)

      done()
    })
  })

  it('create with extended json', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: createExtendedData(plugin.mongodb)
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()
      expect(resp._id).to.be.exists()
      testExtendedData(plugin, testCollection, resp._id, done)
    })
  })

  it('update', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'peter'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'update',
        collection: testCollection,
        data: {
          $set: {
            name: 'nadja'
          }
        },
        query: {
          name: 'peter'
        }
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        expect(resp._id).to.be.exists()
        expect(resp.name).to.be.exists()

        done()
      })
    })
  })

  it('update can query with extended json', function(done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: createExtendedData(plugin.mongodb)
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'update',
        collection: testCollection,
        data: {
          $set: { name: 'foo' }
        },
        query: EJSON.serialize({ date: now }),
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        done()
      })
    })
  })

  it('update with extended json', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'jacob'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'update',
        collection: testCollection,
        data: {
          $set: createExtendedData(plugin.mongodb)
        },
        query: {
          name: 'jacob'
        }
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        expect(resp._id).to.be.exists()
        expect(resp.name).to.be.exists()
        testExtendedData(plugin, testCollection, resp._id, done)
      })
    })
  })

  it('updatebyId', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'peter'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'updateById',
        collection: testCollection,
        data: {
          $set: {
            name: 'nadja'
          }
        },
        id: resp._id
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        expect(resp._id).to.be.exists()
        expect(resp.name).to.be.exists()

        done()
      })
    })
  })

  it('updatebyId with extended json', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'jacob'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'updateById',
        collection: testCollection,
        data: {
          $set: createExtendedData(plugin.mongodb)
        },
        id: resp._id
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        expect(resp._id).to.be.exists()
        expect(resp.name).to.be.exists()
        testExtendedData(plugin, testCollection, resp._id, done)
      })
    })
  })

  it('remove', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'olaf'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'remove',
        collection: testCollection,
        query: {
          name: 'olaf'
        }
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        expect(resp.deletedCount).to.be.equals(1)

        done()
      })
    })
  })

  it('remove can query with extended json', function(done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: createExtendedData(plugin.mongodb)
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'remove',
        collection: testCollection,
        query: EJSON.serialize({ date: now }),
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        expect(resp.deletedCount).to.be.at.least(1)
        done()
      })
    })
  })

  it('removeById', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'olaf'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'removeById',
        collection: testCollection,
        id: resp._id
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp._id).to.be.exists()
        expect(resp.name).to.be.exists()

        done()
      })
    })
  })

  it('findById', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'jens'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'findById',
        collection: testCollection,
        id: resp._id
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp._id).to.be.exists()
        expect(resp.name).to.be.exists()

        done()
      })
    })
  })

  it('find', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'jens'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'find',
        collection: testCollection,
        query: {}
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp.result).to.be.an.array()
        expect(resp.result[0]._id).to.be.exists()
        expect(resp.result[0].name).to.be.exists()
        done()
      })
    })
  })

  it('find can query with extended json', function(done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: createExtendedData(plugin.mongodb)
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'find',
        collection: testCollection,
        query: EJSON.serialize({ date: now }),
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp.result).to.be.an.array()
        expect(resp.result[0]._id).to.be.exists()
        expect(resp.result[0].date).to.be.exists()
        done()
      })
    })
  })

  it('find can query with regular expressions', function(done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: { name: 'Jacob' }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'find',
        collection: testCollection,
        query: EJSON.serialize({ name: new RegExp(/^jac/, 'i') }),
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp.result).to.be.an.array()
        expect(resp.result[0]._id).to.be.exists()
        expect(resp.result[0].name).to.be.exists()
        done()
      })
    })
  })

  it('find with pagination', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'jens'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'find',
        collection: testCollection,
        query: {},
        options: {
          limit: 10,
          offset: 2
        }
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp.result).to.be.an.array()
        expect(resp.result[0]._id).to.be.exists()
        expect(resp.result[0].name).to.be.exists()
        expect(resp.limit).to.be.equals(10)
        expect(resp.offset).to.be.equals(2)
        done()
      })
    })
  })

  it('replace', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'nadine'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'replace',
        collection: testCollection,
        data: {
          $set: {
            name: 'nadja'
          }
        },
        query: {}
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        expect(resp.matchedCount).to.be.exists()
        expect(resp.modifiedCount).to.be.exists()
        expect(resp.upsertedCount).to.be.exists()

        done()
      })
    })
  })

  it('replace with extended json', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'jacob'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      const id = new plugin.mongodb.ObjectID(resp._id)

      hemera.act({
        topic,
        cmd: 'replace',
        collection: testCollection,
        data: {
          $set: createExtendedData(plugin.mongodb)
        },
        query: EJSON.serialize({ _id: id })
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        expect(resp.matchedCount).to.be.exists()
        expect(resp.modifiedCount).to.be.exists()
        expect(resp.upsertedCount).to.be.exists()
        testExtendedData(plugin, testCollection, id, done)
      })
    })
  })

  it('replace can query with extended json', function(done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: createExtendedData(plugin.mongodb)
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'replace',
        collection: testCollection,
        data: {
          $set: {
            name: 'nadja'
          }
        },
        query: EJSON.serialize({ date: now }),
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.an.object()
        expect(resp.matchedCount).to.be.exists()
        expect(resp.modifiedCount).to.be.exists()
        expect(resp.upsertedCount).to.be.exists()
        done()
      })
    })
  })

  it('replaceById', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'nadja'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'replaceById',
        collection: testCollection,
        data: {
          name: 'nadja'
        },
        id: resp._id
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp._id).to.be.exists()
        expect(resp.name).to.be.exists()
        done()
      })
    })
  })

  it('replaceById with extended json', function (done) {
    hemera.act({
      topic,
      cmd: 'create',
      collection: testCollection,
      data: {
        name: 'jacob'
      }
    }, function (err, resp) {
      expect(err).to.be.not.exists()
      expect(resp).to.be.an.object()

      hemera.act({
        topic,
        cmd: 'replaceById',
        collection: testCollection,
        data: createExtendedData(plugin.mongodb),
        id: resp._id
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp._id).to.be.exists()
        expect(resp.name).to.be.exists()
        testExtendedData(plugin, testCollection, resp._id, done)
      })
    })
  })
})

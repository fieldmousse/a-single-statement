const express = require("express"),
    body = require("body-parser"),
    Sequelize = require("sequelize"),
    path = require("path"),
    helmet = require("helmet"),
    http = require("http"),
    iscolor = require("is-color"),
    socketio = require("socket.io"),
    dotenv = require("dotenv");

dotenv.config();
const { PORT } = process.env;

const app = express();
const server = new http.Server(app);
const io = socketio(server);


app.use(body.json());
app.use(helmet());

const db = new Sequelize("app", null, null, {
    host: "localhost",
    dialect: "sqlite",
    storage: path.join(__dirname, "data"),
});

const Tile = db.define("Tile", {
    x: {
        type: Sequelize.INTEGER,
        primaryKey: true,
    },
    y: {
        type: Sequelize.INTEGER,
        primaryKey: true,
    },
    color: {
        type: Sequelize.STRING,
    },
});

db.sync({});

class FriendlyError extends Error {
    constructor(friendly, message = friendly) {
        super(message);
        this.friendly = friendly;
    }
    toString() {
        return this.friendly + "\n" + super.toString();
    }
}

app.use(express.static(path.join(__dirname, "client")));

app.post("/tile", ({ body: { x, y, color } }, res, next) => {
    if ((typeof x === undefined) || (typeof y === undefined)) {
        return next(new FriendlyError("Missing x or y"));
    }
    if (!color) {
        return next(new FriendlyError("Missing color"));
    }
    if (!iscolor(color)) {
        return next(new FriendlyError("Invalid color"));
    }
    Tile.upsert({
        x, y, color,
    }).then(() => {
        io.sockets.emit("tile", { x, y, color });
        res.status(200).end();
    }, next);
});

app.get("/tiles/:x/:y/:width/:height", ({ params: { x, y, width, height } }, res, next) => {
    if ([x, y, width, height].some(n => !Number.isFinite(+n))) {
        return next(new FriendlyError("Invalid box"));
    }
    const replacements = [x, x, width, y, y, height].map(Number);
    db.query(`SELECT x, y, color FROM Tiles 
              WHERE x > ? AND x < (? + ?)
              AND   y > ? AND y < (? + ?)`, { replacements }).then(([tiles, query]) => {
            console.log(query);
            res.json(tiles);
        }, next);
});

app.get("/tiles", (req, res, next) => {
    Tile.findAll({ attributes: ["x", "y", "color"], where: {} }).then(tiles => res.status(200).json(tiles), next);
});

app.get("*", (req, res, next) => {
    res.status(404).send("Not Found").end();
});

app.use((err, req, res, next) => {
    console.error(err);
    const text = err.friendly || "Something went wrong...";
    res.status(500).json(text);
});

io.on("connection", socket => {

});

server.listen(PORT, () => {
    console.log(`HTTP Server listening on port "${PORT}"`);
});

package cradle

// user may have multiple sessions [split screen]
// messages are sent to a session not a user
// agressivly time sessions out - potentially bring them back if needed

// TODO

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"
)

type Session struct {
	updated_on int64
	created_on int64
	active     bool
	messages   map[SessionID][]string
	reply      *func()
}

func (m *Session) Reply() {
	if m.reply != nil {
		(*m.reply)()
		m.reply = nil
	}
}

type GroupID string
type SessionID string

type Fellowship struct {
	Sessions map[GroupID]map[SessionID]*Session
	events   chan func()
}

type get struct {
	group_id   GroupID
	session_id SessionID
	closer     <-chan bool
	reply      chan *FellowshipUpdate
}

type put struct {
	group_id GroupID
	from     SessionID
	to       SessionID
	message  string
}

type FellowshipUpdate struct {
	SessionID SessionID
	Sessions  []SessionID
	Messages  map[SessionID][]string
}

func New() *Fellowship {
	f := &Fellowship{}
	f.Init()
	return f
}

func (f *Fellowship) Init() {
	f.Sessions = map[GroupID]map[SessionID]*Session{}
	f.events = make(chan func())
	go f.handler()
}

func (f *Fellowship) handler() {
	ticker := time.Tick(5 * time.Second)
	for {
		select {
		case <-ticker:
			f.cleanup()
		case event := <-f.events:
			event()
		}
	}
}

func (f *Fellowship) Put(group_id string, from string, to string, message string) {
	p := put{group_id: GroupID(group_id), from: SessionID(from), to: SessionID(to), message: message}
	f.events <- func() { f.handlePut(p) }
}

func (f *Fellowship) cleanup() {
	for _, v := range f.Sessions {
		for _, session := range v {
			session.Reply()
		}
	}
}

func (f *Fellowship) handlePut(put put) {
	fmt.Printf("handle put %v\n", put)

	//From,fok := f.Sessions[group_id][from]
	To, tok := f.Sessions[put.group_id][put.to]

	// TODO also check for the dead flag

	if !tok {
		fmt.Printf("Session mismatch - must be an out of date message u=%s s=%s\n", put.from, put.to)
		return
	}

	To.messages[put.from] = append(To.messages[put.from], put.message)

	if To.reply != nil {
		(*To.reply)()
		To.reply = nil
	}
}

func (f *Fellowship) Get(group_id string, name string, session_id string, closer <-chan bool) *FellowshipUpdate {
	get := get{group_id: GroupID(group_id), session_id: SessionID(session_id), closer: closer, reply: make(chan *FellowshipUpdate)}
	f.events <- func() { f.handleGet(get) }
	return <-get.reply
}

func (f *Fellowship) handleGet(get get) {
	fmt.Printf("handle get %v\n", get)
	group_id := get.group_id
	session_id := get.session_id

	var last int64 = 0

	if f.Sessions[group_id] == nil {
		f.Sessions[group_id] = map[SessionID]*Session{}
	}

	if session_id == "" || f.Sessions[group_id][session_id] == nil { // begin a new session
		session_id = SessionID(randomString(6))
		f.Sessions[group_id][session_id] = &Session{created_on: time.Now().Unix(), messages: map[SessionID][]string{}}
	} else {
		last = f.Sessions[group_id][session_id].updated_on
	}

	session := f.Sessions[group_id][session_id]

	session.Reply()

	success := make(chan bool)

	reply := func() {
		update := &FellowshipUpdate{Sessions: []SessionID{}, Messages: session.messages, SessionID: session_id}
		session.messages = map[SessionID][]string{}

		for k := range f.Sessions[group_id] {
			if k != session_id && f.Sessions[group_id][k].created_on >= last {
				update.Sessions = append(update.Sessions, k)
			}
		}

		success <- true
		get.reply <- update
	}

	go func() {
		session.updated_on = time.Now().Unix()
		session.active = false
		select {
		case <-get.closer:
			f.events <- func() {
				fmt.Printf("Connection closed!\n")
				if session.reply == &reply {
					session.reply = nil
				}
				get.reply <- nil
			}
		case <-success:
		}
	}()

	if len(session.messages) > 0 || get.session_id == "" {
		reply()
	} else {
		session.active = false
		session.reply = &reply
	}
}

func randomString(length int) (str string) {
	b := make([]byte, length)
	rand.Read(b)
	return base64.StdEncoding.EncodeToString(b)
}
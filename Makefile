
all: lint jscs

lint:
	jshint lib/

jscs:
	jscs lib/

.PHONY: all lint jscs

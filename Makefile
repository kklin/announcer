build-docker:
	docker build -t kevinklin/comments-watcher-integration ./comment-watcher
	docker build -t kevinklin/threaded-comments-view ./threaded-view

push-docker: build-docker
	docker push kevinklin/comments-watcher-integration
	docker push kevinklin/threaded-comments-view
